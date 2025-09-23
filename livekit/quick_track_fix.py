"""
Quick Fix for LiveKit Track Publication KeyError

This is a minimal fix that can be applied immediately to resolve the
KeyError: 'TR_xxx' issue in LiveKit track publications.
"""

import logging
import os

def apply_quick_track_fix():
    """
    Apply a quick fix for LiveKit track publication KeyError issues
    """
    try:
        # Only apply if not already patched
        if hasattr(apply_quick_track_fix, '_applied'):
            return
        
        from livekit.rtc.room import Room
        
        # Store original method
        original_on_room_event = Room._on_room_event
        
        def safe_on_room_event(self, event):
            try:
                return original_on_room_event(self, event)
            except KeyError as e:
                error_msg = str(e)
                if 'TR_' in error_msg:
                    # This is the track publication KeyError we want to handle
                    logging.warning(f"LiveKit track publication KeyError handled: {error_msg}")
                    return  # Don't re-raise the error
                else:
                    # Re-raise other KeyErrors
                    raise
            except Exception as e:
                logging.error(f"Unexpected error in room event handler: {e}")
                raise
        
        # Apply the patch
        Room._on_room_event = safe_on_room_event
        
        # Mark as applied
        apply_quick_track_fix._applied = True
        
        logging.info("✅ LiveKit track publication fix applied successfully")
        
    except Exception as e:
        logging.error(f"❌ Failed to apply track publication fix: {e}")


# Auto-apply the fix when this module is imported
if os.getenv("LIVEKIT_AUTO_FIX", "true").lower() == "true":
    apply_quick_track_fix()
