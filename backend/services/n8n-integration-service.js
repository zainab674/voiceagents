// services/n8n-integration-service.js
import axios from 'axios';

class N8NPayloadBuilder {
  constructor() {
    this.logger = console; // Simple logging for now
  }

  /**
   * Build N8N webhook payload
   * @param {Object} assistantConfig - Assistant configuration data
   * @param {Object} callData - Call information
   * @param {Array} sessionHistory - Call transcription history
   * @param {Object} collectedData - Collected user data (name, email, phone)
   * @returns {Object} N8N webhook payload dictionary
   */
  buildPayload(assistantConfig, callData, sessionHistory, collectedData = null) {
    try {
      // Extract assistant info
      const assistantInfo = {
        id: assistantConfig.get?.("id") || assistantConfig.id,
        name: assistantConfig.get?.("name") || assistantConfig.name,
        custom_data: {}
      };

      // Extract call info
      const callInfo = {
        id: callData.call_id,
        from: callData.from_number,
        to: callData.to_number,
        duration: callData.call_duration,
        transcript_url: callData.transcript_url,
        recording_url: callData.recording_url,
        direction: callData.call_direction,
        status: callData.call_status,
        start_time: callData.start_time,
        end_time: callData.end_time,
        participant_identity: callData.participant_identity
      };

      // Extract N8N config
      const n8nConfig = {
        webhook_url: assistantConfig.get?.("n8n_webhook_url") || assistantConfig.n8n_webhook_url,
        auto_create_sheet: assistantConfig.get?.("n8n_auto_create_sheet") || assistantConfig.n8n_auto_create_sheet || false,
        drive_folder_id: assistantConfig.get?.("n8n_drive_folder_id") || assistantConfig.n8n_drive_folder_id,
        spreadsheet_name_template: assistantConfig.get?.("n8n_spreadsheet_name_template") || assistantConfig.n8n_spreadsheet_name_template,
        sheet_tab_template: assistantConfig.get?.("n8n_sheet_tab_template") || assistantConfig.n8n_sheet_tab_template,
        spreadsheet_id: assistantConfig.get?.("n8n_spreadsheet_id") || assistantConfig.n8n_spreadsheet_id,
        sheet_tab: assistantConfig.get?.("n8n_sheet_tab") || assistantConfig.n8n_sheet_tab,
        save_fields: {
          name: assistantConfig.get?.("n8n_save_name") || assistantConfig.n8n_save_name || false,
          email: assistantConfig.get?.("n8n_save_email") || assistantConfig.n8n_save_email || false,
          phone: assistantConfig.get?.("n8n_save_phone") || assistantConfig.n8n_save_phone || false,
          summary: assistantConfig.get?.("n8n_save_summary") || assistantConfig.n8n_save_summary || false,
          sentiment: assistantConfig.get?.("n8n_save_sentiment") || assistantConfig.n8n_save_sentiment || false,
          labels: assistantConfig.get?.("n8n_save_labels") || assistantConfig.n8n_save_labels || false,
          recording_url: assistantConfig.get?.("n8n_save_recording_url") || assistantConfig.n8n_save_recording_url || false,
          transcript_url: assistantConfig.get?.("n8n_save_transcript_url") || assistantConfig.n8n_save_transcript_url || false,
          duration: assistantConfig.get?.("n8n_save_duration") || assistantConfig.n8n_save_duration || false,
          call_direction: assistantConfig.get?.("n8n_save_call_direction") || assistantConfig.n8n_save_call_direction || false,
          from_number: assistantConfig.get?.("n8n_save_from_number") || assistantConfig.n8n_save_from_number || false,
          to_number: assistantConfig.get?.("n8n_save_to_number") || assistantConfig.n8n_save_to_number || false,
          cost: assistantConfig.get?.("n8n_save_cost") || assistantConfig.n8n_save_cost || false
        },
        custom_fields: assistantConfig.get?.("n8n_custom_fields") || assistantConfig.n8n_custom_fields || []
      };

      // Build conversation summary
      const conversationSummary = this._buildConversationSummary(sessionHistory);

      // Add collected contact information
      let contactInfo = {};
      if (collectedData) {
        contactInfo = {
          name: collectedData.name,
          email: collectedData.email,
          phone: collectedData.phone
        };
      }

      // Build the complete payload
      const payload = {
        assistant: assistantInfo,
        call: callInfo,
        n8n_config: n8nConfig,
        conversation_summary: conversationSummary,
        transcript: sessionHistory,
        contact_info: contactInfo,
        timestamp: new Date().toISOString()
      };

      this.logger.info(
        `N8N_PAYLOAD_BUILT | assistant_id=${assistantInfo.id} | call_id=${callInfo.id} | payload_keys=${Object.keys(payload).join(',')}`
      );

      return payload;

    } catch (error) {
      this.logger.error(`N8N_PAYLOAD_BUILD_ERROR | error=${error.message}`);
      return {};
    }
  }

  /**
   * Build conversation summary from session history
   * @param {Array} sessionHistory - Session history array
   * @returns {string} Conversation summary
   */
  _buildConversationSummary(sessionHistory) {
    if (!sessionHistory || sessionHistory.length === 0) {
      return "";
    }

    // Extract user messages for summary
    const userMessages = [];
    for (const item of sessionHistory) {
      if (typeof item === 'object' && item.role === "user" && item.content) {
        let content = item.content;
        if (Array.isArray(content)) {
          content = content.join(" ");
        }
        userMessages.push(String(content).trim());
      }
    }

    if (userMessages.length > 0) {
      return userMessages.join(" ");
    }

    return "";
  }
}

class N8NIntegration {
  constructor() {
    this.logger = console; // Simple logging for now
    this.payloadBuilder = new N8NPayloadBuilder();
  }

  /**
   * Send data to N8N webhook
   * @param {string} webhookUrl - N8N webhook URL
   * @param {Object} payload - Data payload to send
   * @param {number} timeout - Request timeout in seconds
   * @returns {Promise<Object|null>} Response data or null if failed
   */
  async sendWebhook(webhookUrl, payload, timeout = 30) {
    try {
      // Convert payload to JSON
      const jsonData = JSON.stringify(payload);

      this.logger.info(
        `N8N_WEBHOOK_SENDING | url=${webhookUrl} | payload_size=${jsonData.length}`
      );

      const response = await axios.post(webhookUrl, payload, {
        timeout: timeout * 1000,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "VoiceAgents-N8N-Integration/1.0"
        }
      });

      if (response.status === 200) {
        this.logger.info(
          `N8N_WEBHOOK_SUCCESS | status=${response.status} | response_size=${JSON.stringify(response.data).length}`
        );
        return response.data;
      } else {
        this.logger.warning(
          `N8N_WEBHOOK_ERROR | status=${response.status} | response=${JSON.stringify(response.data)}`
        );
        return null;
      }

    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        this.logger.error(`N8N_WEBHOOK_TIMEOUT | url=${webhookUrl}`);
      } else {
        this.logger.error(`N8N_WEBHOOK_ERROR | url=${webhookUrl} | error=${error.message}`);
      }
      return null;
    }
  }

  /**
   * Process call completion and send to N8N
   * @param {Object} assistantConfig - Assistant configuration
   * @param {Object} callData - Call data
   * @param {Array} sessionHistory - Call transcription
   * @param {Object} collectedData - Collected user data
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async processCallCompletion(assistantConfig, callData, sessionHistory, collectedData = null) {
    const webhookUrl = assistantConfig.get?.("n8n_webhook_url") || assistantConfig.n8n_webhook_url;
    if (!webhookUrl) {
      this.logger.info("N8N_WEBHOOK_SKIPPED | no webhook URL configured");
      return false;
    }

    // Build payload
    const payload = this.payloadBuilder.buildPayload(
      assistantConfig, callData, sessionHistory, collectedData
    );

    if (!payload || Object.keys(payload).length === 0) {
      this.logger.error("N8N_PAYLOAD_BUILD_FAILED");
      return false;
    }

    // Send webhook
    const response = await this.sendWebhook(webhookUrl, payload);

    if (response) {
      // Check if N8N returned a new spreadsheet ID
      if (response.spreadsheet_id) {
        this.logger.info(
          `N8N_SPREADSHEET_CREATED | spreadsheet_id=${response.spreadsheet_id}`
        );
      }

      this.logger.info("N8N_WEBHOOK_COMPLETED");
      return true;
    } else {
      this.logger.warning("N8N_WEBHOOK_FAILED");
      return false;
    }
  }
}

export { N8NIntegration, N8NPayloadBuilder };
