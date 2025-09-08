// controllers/phoneNumberController.js
import { 
  getPhoneNumbers,
  getPhoneNumberById,
  upsertPhoneNumber,
  updatePhoneNumber,
  deletePhoneNumber,
  getPhoneNumbersByAssistant,
  isPhoneNumberAssigned
} from '../services/phoneNumberService.js';

// Get all phone numbers for a user
export const getPhoneNumbersController = async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await getPhoneNumbers(userId);
    
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error) {
    console.error('getPhoneNumbersController error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get a specific phone number by ID
export const getPhoneNumberByIdController = async (req, res) => {
  try {
    const { phoneNumberId } = req.params;
    const userId = req.user.userId;
    
    if (!phoneNumberId) {
      return res.status(400).json({
        success: false,
        message: 'Phone number ID is required'
      });
    }

    const result = await getPhoneNumberById(phoneNumberId, userId);
    
    const status = result.success ? 200 : 404;
    res.status(status).json(result);
  } catch (error) {
    console.error('getPhoneNumberByIdController error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create or update a phone number
export const upsertPhoneNumberController = async (req, res) => {
  try {
    const userId = req.user.userId;
    const phoneNumberData = req.body;
    
    // Validate required fields
    if (!phoneNumberData.number) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const result = await upsertPhoneNumber(phoneNumberData, userId);
    
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error) {
    console.error('upsertPhoneNumberController error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update a phone number
export const updatePhoneNumberController = async (req, res) => {
  try {
    const { phoneNumberId } = req.params;
    const userId = req.user.userId;
    const updateData = req.body;
    
    if (!phoneNumberId) {
      return res.status(400).json({
        success: false,
        message: 'Phone number ID is required'
      });
    }

    const result = await updatePhoneNumber(phoneNumberId, updateData, userId);
    
    const status = result.success ? 200 : 404;
    res.status(status).json(result);
  } catch (error) {
    console.error('updatePhoneNumberController error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete a phone number
export const deletePhoneNumberController = async (req, res) => {
  try {
    const { phoneNumberId } = req.params;
    const userId = req.user.userId;
    
    if (!phoneNumberId) {
      return res.status(400).json({
        success: false,
        message: 'Phone number ID is required'
      });
    }

    const result = await deletePhoneNumber(phoneNumberId, userId);
    
    const status = result.success ? 200 : 404;
    res.status(status).json(result);
  } catch (error) {
    console.error('deletePhoneNumberController error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get phone numbers by assistant ID
export const getPhoneNumbersByAssistantController = async (req, res) => {
  try {
    const { assistantId } = req.params;
    const userId = req.user.userId;
    
    if (!assistantId) {
      return res.status(400).json({
        success: false,
        message: 'Assistant ID is required'
      });
    }

    const result = await getPhoneNumbersByAssistant(assistantId, userId);
    
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error) {
    console.error('getPhoneNumbersByAssistantController error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Check if a phone number is assigned
export const isPhoneNumberAssignedController = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const userId = req.user.userId;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const result = await isPhoneNumberAssigned(phoneNumber, userId);
    
    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error) {
    console.error('isPhoneNumberAssignedController error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
