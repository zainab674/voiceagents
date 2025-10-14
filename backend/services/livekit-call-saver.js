// services/livekit-call-saver.js
import CallHistoryService from './call-history-service.js';

class LiveKitCallSaver {
  constructor() {
    this.callHistoryService = new CallHistoryService();
  }

  /**
   * Save comprehensive call data from LiveKit session
   * @param {Object} sessionData - LiveKit session data
   * @param {Object} assistantConfig - Assistant configuration
   * @param {Object} analysisResults - AI analysis results
   * @returns {Promise<Object>} - Save result
   */
  async saveCallFromLiveKitSession(sessionData, assistantConfig, analysisResults = {}) {
    try {
      console.log('Saving LiveKit call session:', {
        roomName: sessionData.roomName,
        assistantId: assistantConfig.id,
        duration: sessionData.duration,
        transcriptionItems: sessionData.transcription?.length || 0
      });

      // Extract phone number from room name
      const phoneNumber = this.callHistoryService.extractPhoneFromRoom(sessionData.roomName);
      
      // Process transcription
      const transcription = this.callHistoryService.processTranscription(sessionData.sessionHistory || []);

      // Prepare call data using existing table structure
      const callData = {
        call_id: sessionData.roomName, // Use room name as call ID
        assistant_id: assistantConfig.id,
        user_id: assistantConfig.user_id || null,
        phone_number: phoneNumber,
        start_time: sessionData.startTime || new Date().toISOString(),
        end_time: sessionData.endTime || new Date().toISOString(),
        call_duration: sessionData.duration || 0,
        call_status: 'completed',
        transcription: transcription,
        call_sid: sessionData.callSid,
        outcome: 'completed',
        success: true,
        notes: null
      };

      // Save to database
      const result = await this.callHistoryService.saveCallHistory(callData);

      if (result.success) {
        console.log('LiveKit call session saved successfully:', {
          callId: result.data.id,
          duration: result.data.duration_seconds,
          outcome: result.data.call_outcome,
          transcriptionItems: result.data.transcription?.length || 0
        });
      } else {
        console.error('Failed to save LiveKit call session:', result.error);
      }

      return result;

    } catch (error) {
      console.error('Exception saving LiveKit call session:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract call SID from LiveKit participant
   * @param {Object} participant - LiveKit participant
   * @param {Object} roomMetadata - Room metadata
   * @returns {string|null} - Call SID
   */
  extractCallSid(participant, roomMetadata) {
    return this.callHistoryService.extractCallSid(participant, roomMetadata);
  }

  /**
   * Process session history into transcription format
   * @param {Array} sessionHistory - Raw session history
   * @returns {Array} - Processed transcription
   */
  processTranscription(sessionHistory) {
    return this.callHistoryService.processTranscription(sessionHistory);
  }

  /**
   * Extract phone number from room name
   * @param {string} roomName - LiveKit room name
   * @returns {string|null} - Phone number
   */
  extractPhoneFromRoom(roomName) {
    return this.callHistoryService.extractPhoneFromRoom(roomName);
  }

  /**
   * Create comprehensive session data object
   * @param {Object} room - LiveKit room
   * @param {Object} participant - LiveKit participant
   * @param {Array} sessionHistory - Session history
   * @param {Object} recordingData - Recording data
   * @returns {Object} - Comprehensive session data
   */
  createSessionData(room, participant, sessionHistory, recordingData = {}) {
    const startTime = new Date(room.creationTime || Date.now());
    const endTime = new Date();
    const duration = Math.floor((endTime - startTime) / 1000);

    return {
      roomName: room.name,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: duration,
      sessionHistory: sessionHistory,
      callSid: this.extractCallSid(participant, room.metadata),
      ...recordingData
    };
  }

  /**
   * Create analysis results object
   * @param {Object} aiAnalysis - AI analysis data
   * @param {Object} structuredData - Structured data extraction
   * @param {Object} outcomeAnalysis - Outcome analysis
   * @returns {Object} - Combined analysis results
   */
  createAnalysisResults(aiAnalysis = {}, structuredData = {}, outcomeAnalysis = {}) {
    return {
      call_summary: aiAnalysis.summary,
      call_success: aiAnalysis.success,
      structured_data: structuredData,
      call_outcome: outcomeAnalysis.outcome,
      outcome_confidence: outcomeAnalysis.confidence,
      outcome_reasoning: outcomeAnalysis.reasoning,
      outcome_key_points: outcomeAnalysis.key_points,
      outcome_sentiment: outcomeAnalysis.sentiment,
      follow_up_required: outcomeAnalysis.follow_up_required,
      follow_up_notes: outcomeAnalysis.follow_up_notes
    };
  }
}

export default LiveKitCallSaver;
