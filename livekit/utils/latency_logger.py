"""
Sophisticated latency tracking system for LiveKit voice agent operations.
Measures latency for every operation with context managers and decorators.
Tracks specific metrics: participant_wait, room_connection, call_processing, llm_latency, tts_latency
Provides detailed analytics and performance insights.
Logs total latency breakdown: transcription_delay + llm + tts = total_latency
"""

import time
import logging
import functools
import asyncio
from typing import Optional, Dict, Any, Callable, Union, List
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass, field
from datetime import datetime
import json
import threading
from collections import defaultdict

from .logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class LatencyMeasurement:
    """Represents a single latency measurement with enhanced metadata."""
    operation: str
    duration_ms: float
    timestamp: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)
    success: bool = True
    error: Optional[str] = None
    call_id: Optional[str] = None
    room_name: Optional[str] = None
    participant_id: Optional[str] = None


@dataclass
class LatencyBreakdown:
    """Detailed breakdown of latency components."""
    transcription_delay_ms: float = 0.0
    llm_latency_ms: float = 0.0
    tts_latency_ms: float = 0.0
    participant_wait_ms: float = 0.0
    room_connection_ms: float = 0.0
    call_processing_ms: float = 0.0
    total_latency_ms: float = 0.0
    
    def calculate_total(self):
        """Calculate total latency from components."""
        self.total_latency_ms = (
            self.transcription_delay_ms + 
            self.llm_latency_ms + 
            self.tts_latency_ms + 
            self.participant_wait_ms + 
            self.room_connection_ms + 
            self.call_processing_ms
        )
        return self.total_latency_ms


class LatencyTracker:
    """Enhanced latency tracker for call sessions with detailed analytics."""
    
    def __init__(self, call_id: str, room_name: str = "", participant_id: str = ""):
        self.call_id = call_id
        self.room_name = room_name
        self.participant_id = participant_id
        self.measurements: List[LatencyMeasurement] = []
        self.start_time = time.time()
        self.breakdown = LatencyBreakdown()
        self._lock = threading.Lock()
        
        # Track specific metrics
        self.metrics = {
            'participant_wait': [],
            'room_connection': [],
            'call_processing': [],
            'llm_latency': [],
            'tts_latency': [],
            'transcription_delay': []
        }
        
    def add_measurement(self, measurement: LatencyMeasurement):
        """Add a latency measurement to the tracker with thread safety."""
        with self._lock:
            self.measurements.append(measurement)
            
            # Update specific metrics
            operation_lower = measurement.operation.lower()
            for metric_name in self.metrics.keys():
                if metric_name in operation_lower:
                    self.metrics[metric_name].append(measurement.duration_ms)
            
            # Update breakdown
            self._update_breakdown(measurement)
            
            # Log the measurement immediately
            self._log_measurement(measurement)
    
    def _update_breakdown(self, measurement: LatencyMeasurement):
        """Update the latency breakdown based on measurement."""
        operation_lower = measurement.operation.lower()
        
        if 'transcription' in operation_lower or 'stt' in operation_lower:
            self.breakdown.transcription_delay_ms += measurement.duration_ms
        elif 'llm' in operation_lower or 'gpt' in operation_lower or 'assistant' in operation_lower:
            self.breakdown.llm_latency_ms += measurement.duration_ms
        elif 'tts' in operation_lower or 'synthesis' in operation_lower:
            self.breakdown.tts_latency_ms += measurement.duration_ms
        elif 'participant_wait' in operation_lower:
            self.breakdown.participant_wait_ms += measurement.duration_ms
        elif 'room_connection' in operation_lower or 'connect' in operation_lower:
            self.breakdown.room_connection_ms += measurement.duration_ms
        elif 'call_processing' in operation_lower or 'process' in operation_lower:
            self.breakdown.call_processing_ms += measurement.duration_ms
        
        # Recalculate total
        self.breakdown.calculate_total()
    
    def _log_measurement(self, measurement: LatencyMeasurement):
        """Log individual measurement with enhanced formatting."""
        status = "SUCCESS" if measurement.success else "ERROR"
        
        logger.info(
            f"LATENCY_MEASUREMENT | "
            f"call_id={self.call_id} | "
            f"room={self.room_name} | "
            f"participant={self.participant_id} | "
            f"operation={measurement.operation} | "
            f"duration_ms={measurement.duration_ms:.2f} | "
            f"status={status} | "
            f"metadata={json.dumps(measurement.metadata)}"
        )
        
        if measurement.error:
            logger.error(
                f"LATENCY_ERROR | "
                f"call_id={self.call_id} | "
                f"operation={measurement.operation} | "
                f"error={measurement.error}"
            )
    
    def get_summary(self) -> Dict[str, Any]:
        """Get comprehensive latency summary with analytics."""
        with self._lock:
            if not self.measurements:
                return {"total_operations": 0, "total_duration_ms": 0}
            
            successful_measurements = [m for m in self.measurements if m.success]
            failed_measurements = [m for m in self.measurements if not m.success]
            
            total_duration = sum(m.duration_ms for m in successful_measurements)
            
            # Group by operation type with enhanced stats
            operation_stats = {}
            for measurement in successful_measurements:
                op = measurement.operation
                if op not in operation_stats:
                    operation_stats[op] = {
                        "count": 0,
                        "total_ms": 0,
                        "min_ms": float('inf'),
                        "max_ms": 0,
                        "avg_ms": 0,
                        "p95_ms": 0,
                        "p99_ms": 0
                    }
                
                stats = operation_stats[op]
                stats["count"] += 1
                stats["total_ms"] += measurement.duration_ms
                stats["min_ms"] = min(stats["min_ms"], measurement.duration_ms)
                stats["max_ms"] = max(stats["max_ms"], measurement.duration_ms)
            
            # Calculate averages and percentiles
            for stats in operation_stats.values():
                stats["avg_ms"] = stats["total_ms"] / stats["count"]
                stats["min_ms"] = stats["min_ms"] if stats["min_ms"] != float('inf') else 0
                
                # Calculate percentiles
                durations = [m.duration_ms for m in successful_measurements 
                           if m.operation == next(op for op, s in operation_stats.items() if s == stats)]
                if durations:
                    sorted_durations = sorted(durations)
                    n = len(sorted_durations)
                    stats["p95_ms"] = sorted_durations[int(0.95 * n)] if n > 0 else 0
                    stats["p99_ms"] = sorted_durations[int(0.99 * n)] if n > 0 else 0
            
            # Calculate metric-specific analytics
            metric_analytics = {}
            for metric_name, durations in self.metrics.items():
                if durations:
                    metric_analytics[metric_name] = {
                        "count": len(durations),
                        "total_ms": sum(durations),
                        "avg_ms": sum(durations) / len(durations),
                        "min_ms": min(durations),
                        "max_ms": max(durations),
                        "p95_ms": sorted(durations)[int(0.95 * len(durations))] if durations else 0,
                        "p99_ms": sorted(durations)[int(0.99 * len(durations))] if durations else 0
                    }
            
            return {
                "call_id": self.call_id,
                "room_name": self.room_name,
                "participant_id": self.participant_id,
                "total_operations": len(self.measurements),
                "successful_operations": len(successful_measurements),
                "failed_operations": len(failed_measurements),
                "total_duration_ms": total_duration,
                "call_duration_ms": (time.time() - self.start_time) * 1000,
                "operation_stats": operation_stats,
                "metric_analytics": metric_analytics,
                "latency_breakdown": {
                    "transcription_delay_ms": self.breakdown.transcription_delay_ms,
                    "llm_latency_ms": self.breakdown.llm_latency_ms,
                    "tts_latency_ms": self.breakdown.tts_latency_ms,
                    "participant_wait_ms": self.breakdown.participant_wait_ms,
                    "room_connection_ms": self.breakdown.room_connection_ms,
                    "call_processing_ms": self.breakdown.call_processing_ms,
                    "total_latency_ms": self.breakdown.total_latency_ms
                },
                "failed_operations": [{"operation": m.operation, "error": m.error} for m in failed_measurements]
            }
    
    def log_summary(self):
        """Log comprehensive latency summary with breakdown."""
        summary = self.get_summary()
        
        # Log overall summary
        logger.info(
            f"LATENCY_SUMMARY | "
            f"call_id={self.call_id} | "
            f"room={self.room_name} | "
            f"participant={self.participant_id} | "
            f"total_ops={summary['total_operations']} | "
            f"successful_ops={summary['successful_operations']} | "
            f"failed_ops={summary['failed_operations']} | "
            f"total_duration_ms={summary['total_duration_ms']:.2f} | "
            f"call_duration_ms={summary['call_duration_ms']:.2f}"
        )
        
        # Log latency breakdown
        breakdown = summary['latency_breakdown']
        logger.info(
            f"LATENCY_BREAKDOWN | "
            f"call_id={self.call_id} | "
            f"transcription_delay_ms={breakdown['transcription_delay_ms']:.2f} | "
            f"llm_latency_ms={breakdown['llm_latency_ms']:.2f} | "
            f"tts_latency_ms={breakdown['tts_latency_ms']:.2f} | "
            f"participant_wait_ms={breakdown['participant_wait_ms']:.2f} | "
            f"room_connection_ms={breakdown['room_connection_ms']:.2f} | "
            f"call_processing_ms={breakdown['call_processing_ms']:.2f} | "
            f"total_latency_ms={breakdown['total_latency_ms']:.2f}"
        )
        
        # Log operation-specific stats
        for operation, stats in summary["operation_stats"].items():
            logger.info(
                f"LATENCY_OPERATION_STATS | "
                f"call_id={self.call_id} | "
                f"operation={operation} | "
                f"count={stats['count']} | "
                f"avg_ms={stats['avg_ms']:.2f} | "
                f"min_ms={stats['min_ms']:.2f} | "
                f"max_ms={stats['max_ms']:.2f} | "
                f"p95_ms={stats['p95_ms']:.2f} | "
                f"p99_ms={stats['p99_ms']:.2f} | "
                f"total_ms={stats['total_ms']:.2f}"
            )
        
        # Log metric-specific analytics
        for metric_name, analytics in summary["metric_analytics"].items():
            logger.info(
                f"LATENCY_METRIC_ANALYTICS | "
                f"call_id={self.call_id} | "
                f"metric={metric_name} | "
                f"count={analytics['count']} | "
                f"avg_ms={analytics['avg_ms']:.2f} | "
                f"min_ms={analytics['min_ms']:.2f} | "
                f"max_ms={analytics['max_ms']:.2f} | "
                f"p95_ms={analytics['p95_ms']:.2f} | "
                f"p99_ms={analytics['p99_ms']:.2f}"
            )
        
        # Log failed operations
        for failed_op in summary["failed_operations"]:
            logger.error(
                f"LATENCY_FAILED_OPERATION | "
                f"call_id={self.call_id} | "
                f"operation={failed_op['operation']} | "
                f"error={failed_op['error']}"
            )


# Global tracker storage with thread safety
_trackers: Dict[str, LatencyTracker] = {}
_trackers_lock = threading.Lock()


def get_tracker(call_id: str, room_name: str = "", participant_id: str = "") -> LatencyTracker:
    """Get or create a latency tracker for a call with thread safety."""
    with _trackers_lock:
        if call_id not in _trackers:
            _trackers[call_id] = LatencyTracker(call_id, room_name, participant_id)
        return _trackers[call_id]


def clear_tracker(call_id: str):
    """Clear a latency tracker (call when call ends)."""
    with _trackers_lock:
        if call_id in _trackers:
            tracker = _trackers[call_id]
            tracker.log_summary()
            del _trackers[call_id]


def measure_latency(
    operation: str,
    call_id: Optional[str] = None,
    room_name: Optional[str] = None,
    participant_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    log_level: int = logging.INFO
):
    """
    Enhanced decorator to measure latency of a function or method.
    
    Args:
        operation: Name of the operation being measured
        call_id: Call ID for grouping measurements (optional)
        room_name: Room name for context (optional)
        participant_id: Participant ID for context (optional)
        metadata: Additional metadata to log with the measurement
        log_level: Logging level for the measurement
    """
    def decorator(func: Callable):
        if asyncio.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                start_time = time.time()
                success = True
                error = None
                
                try:
                    result = await func(*args, **kwargs)
                    return result
                except Exception as e:
                    success = False
                    error = str(e)
                    raise
                finally:
                    duration_ms = (time.time() - start_time) * 1000
                    
                    measurement = LatencyMeasurement(
                        operation=operation,
                        duration_ms=duration_ms,
                        timestamp=datetime.now(),
                        metadata=metadata or {},
                        success=success,
                        error=error,
                        call_id=call_id,
                        room_name=room_name,
                        participant_id=participant_id
                    )
                    
                    if call_id:
                        tracker = get_tracker(call_id, room_name or "", participant_id or "")
                        tracker.add_measurement(measurement)
                    else:
                        # Log directly if no call_id provided
                        status = "SUCCESS" if success else "ERROR"
                        logger.log(
                            log_level,
                            f"LATENCY_MEASUREMENT | "
                            f"operation={operation} | "
                            f"duration_ms={duration_ms:.2f} | "
                            f"status={status} | "
                            f"metadata={json.dumps(metadata or {})}"
                        )
            
            return async_wrapper
        else:
            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                start_time = time.time()
                success = True
                error = None
                
                try:
                    result = func(*args, **kwargs)
                    return result
                except Exception as e:
                    success = False
                    error = str(e)
                    raise
                finally:
                    duration_ms = (time.time() - start_time) * 1000
                    
                    measurement = LatencyMeasurement(
                        operation=operation,
                        duration_ms=duration_ms,
                        timestamp=datetime.now(),
                        metadata=metadata or {},
                        success=success,
                        error=error,
                        call_id=call_id,
                        room_name=room_name,
                        participant_id=participant_id
                    )
                    
                    if call_id:
                        tracker = get_tracker(call_id, room_name or "", participant_id or "")
                        tracker.add_measurement(measurement)
                    else:
                        # Log directly if no call_id provided
                        status = "SUCCESS" if success else "ERROR"
                        logger.log(
                            log_level,
                            f"LATENCY_MEASUREMENT | "
                            f"operation={operation} | "
                            f"duration_ms={duration_ms:.2f} | "
                            f"status={status} | "
                            f"metadata={json.dumps(metadata or {})}"
                        )
            
            return sync_wrapper
    
    return decorator


@asynccontextmanager
async def measure_latency_context(
    operation: str,
    call_id: Optional[str] = None,
    room_name: Optional[str] = None,
    participant_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Enhanced async context manager for measuring latency of code blocks.
    
    Usage:
        async with measure_latency_context("database_query", call_id="call_123", room_name="room_456"):
            result = await database.query()
    """
    start_time = time.time()
    success = True
    error = None
    
    try:
        yield
    except Exception as e:
        success = False
        error = str(e)
        raise
    finally:
        duration_ms = (time.time() - start_time) * 1000
        
        measurement = LatencyMeasurement(
            operation=operation,
            duration_ms=duration_ms,
            timestamp=datetime.now(),
            metadata=metadata or {},
            success=success,
            error=error,
            call_id=call_id,
            room_name=room_name,
            participant_id=participant_id
        )
        
        if call_id:
            tracker = get_tracker(call_id, room_name or "", participant_id or "")
            tracker.add_measurement(measurement)
        else:
            # Log directly if no call_id provided
            status = "SUCCESS" if success else "ERROR"
            logger.info(
                f"LATENCY_MEASUREMENT | "
                f"operation={operation} | "
                f"duration_ms={duration_ms:.2f} | "
                f"status={status} | "
                f"metadata={json.dumps(metadata or {})}"
            )


@contextmanager
def measure_latency_sync_context(
    operation: str,
    call_id: Optional[str] = None,
    room_name: Optional[str] = None,
    participant_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Enhanced sync context manager for measuring latency of code blocks.
    
    Usage:
        with measure_latency_sync_context("file_operation", call_id="call_123"):
            result = file.read()
    """
    start_time = time.time()
    success = True
    error = None
    
    try:
        yield
    except Exception as e:
        success = False
        error = str(e)
        raise
    finally:
        duration_ms = (time.time() - start_time) * 1000
        
        measurement = LatencyMeasurement(
            operation=operation,
            duration_ms=duration_ms,
            timestamp=datetime.now(),
            metadata=metadata or {},
            success=success,
            error=error,
            call_id=call_id,
            room_name=room_name,
            participant_id=participant_id
        )
        
        if call_id:
            tracker = get_tracker(call_id, room_name or "", participant_id or "")
            tracker.add_measurement(measurement)
        else:
            # Log directly if no call_id provided
            status = "SUCCESS" if success else "ERROR"
            logger.info(
                f"LATENCY_MEASUREMENT | "
                f"operation={operation} | "
                f"duration_ms={duration_ms:.2f} | "
                f"status={status} | "
                f"metadata={json.dumps(metadata or {})}"
            )


def log_latency_measurement(
    operation: str,
    duration_ms: float,
    call_id: Optional[str] = None,
    room_name: Optional[str] = None,
    participant_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    success: bool = True,
    error: Optional[str] = None
):
    """
    Manually log a latency measurement with enhanced context.
    
    Args:
        operation: Name of the operation
        duration_ms: Duration in milliseconds
        call_id: Call ID for grouping measurements
        room_name: Room name for context
        participant_id: Participant ID for context
        metadata: Additional metadata
        success: Whether the operation was successful
        error: Error message if operation failed
    """
    measurement = LatencyMeasurement(
        operation=operation,
        duration_ms=duration_ms,
        timestamp=datetime.now(),
        metadata=metadata or {},
        success=success,
        error=error,
        call_id=call_id,
        room_name=room_name,
        participant_id=participant_id
    )
    
    if call_id:
        tracker = get_tracker(call_id, room_name or "", participant_id or "")
        tracker.add_measurement(measurement)
    else:
        # Log directly if no call_id provided
        status = "SUCCESS" if success else "ERROR"
        logger.info(
            f"LATENCY_MEASUREMENT | "
            f"operation={operation} | "
            f"duration_ms={duration_ms:.2f} | "
            f"status={status} | "
            f"metadata={json.dumps(metadata or {})}"
        )


class LatencyProfiler:
    """Advanced latency profiler for complex operations with checkpoint tracking."""
    
    def __init__(self, call_id: str, operation: str, room_name: str = "", participant_id: str = ""):
        self.call_id = call_id
        self.operation = operation
        self.room_name = room_name
        self.participant_id = participant_id
        self.start_time = time.time()
        self.checkpoints: Dict[str, float] = {}
        self.metadata: Dict[str, Any] = {}
    
    def checkpoint(self, name: str, metadata: Optional[Dict[str, Any]] = None):
        """Record a checkpoint with optional metadata."""
        self.checkpoints[name] = time.time()
        if metadata:
            self.metadata[name] = metadata
    
    def finish(self, success: bool = True, error: Optional[str] = None):
        """Finish profiling and log all measurements."""
        total_duration = (time.time() - self.start_time) * 1000
        
        # Log total operation duration
        log_latency_measurement(
            operation=self.operation,
            duration_ms=total_duration,
            call_id=self.call_id,
            room_name=self.room_name,
            participant_id=self.participant_id,
            metadata=self.metadata,
            success=success,
            error=error
        )
        
        # Log individual checkpoint durations
        prev_time = self.start_time
        for checkpoint_name, checkpoint_time in self.checkpoints.items():
            checkpoint_duration = (checkpoint_time - prev_time) * 1000
            checkpoint_metadata = self.metadata.get(checkpoint_name, {})
            
            log_latency_measurement(
                operation=f"{self.operation}.{checkpoint_name}",
                duration_ms=checkpoint_duration,
                call_id=self.call_id,
                room_name=self.room_name,
                participant_id=self.participant_id,
                metadata=checkpoint_metadata,
                success=success
            )
            
            prev_time = checkpoint_time
        
        # Log final segment
        if self.checkpoints:
            final_checkpoint_time = max(self.checkpoints.values())
            final_duration = (time.time() - final_checkpoint_time) * 1000
            
            log_latency_measurement(
                operation=f"{self.operation}.final",
                duration_ms=final_duration,
                call_id=self.call_id,
                room_name=self.room_name,
                participant_id=self.participant_id,
                success=success
            )


# Convenience functions for specific metrics
def measure_participant_wait(call_id: str, room_name: str = "", participant_id: str = ""):
    """Convenience decorator for measuring participant wait times."""
    return measure_latency("participant_wait", call_id, room_name, participant_id)


def measure_room_connection(call_id: str, room_name: str = "", participant_id: str = ""):
    """Convenience decorator for measuring room connection times."""
    return measure_latency("room_connection", call_id, room_name, participant_id)


def measure_call_processing(call_id: str, room_name: str = "", participant_id: str = ""):
    """Convenience decorator for measuring call processing times."""
    return measure_latency("call_processing", call_id, room_name, participant_id)


def measure_llm_latency(call_id: str, room_name: str = "", participant_id: str = ""):
    """Convenience decorator for measuring LLM latency."""
    return measure_latency("llm_latency", call_id, room_name, participant_id)


def measure_tts_latency(call_id: str, room_name: str = "", participant_id: str = ""):
    """Convenience decorator for measuring TTS latency."""
    return measure_latency("tts_latency", call_id, room_name, participant_id)


def measure_transcription_delay(call_id: str, room_name: str = "", participant_id: str = ""):
    """Convenience decorator for measuring transcription delay."""
    return measure_latency("transcription_delay", call_id, room_name, participant_id)
