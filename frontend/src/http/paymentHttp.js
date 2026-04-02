import api from './index';

export const paymentApi = {
    /**
     * Create a Stripe Checkout Session
     * @param {Object} data
     * @param {string} data.planKey - The key of the plan to subscribe to
     * @param {string} data.successUrl - URL to redirect to on success
     * @param {string} data.cancelUrl - URL to redirect to on cancel
     * @param {string} [data.userId] - Optional user ID if authentication is available
     * @param {string} [data.customerEmail] - Optional email for pre-filling Stripe
     */
    createCheckoutSession: async (data) => {
        try {
            const response = await api.post('/api/v1/payments/create-checkout-session', data);
            return response.data;
        } catch (error) {
            console.error('Error creating checkout session:', error);
            throw error;
        }
    },

    /**
     * Activate a pending_payment user after Stripe checkout completes.
     * @param {Object} data
     * @param {string} data.sessionId - The Stripe checkout session ID from the success URL
     * @param {string} [data.tenant] - The tenant slug (for whitelabel)
     */
    activateAfterPayment: async (data) => {
        try {
            const response = await api.post('/api/v1/payments/activate-after-payment', data);
            return response.data;
        } catch (error) {
            console.error('Error activating after payment:', error);
            throw error;
        }
    }
};
