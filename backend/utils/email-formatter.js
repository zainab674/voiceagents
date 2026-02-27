/**
 * Utility to format email body content.
 * Converts plain text to HTML with paragraph and line breaks.
 */
export const formatEmailBody = (content) => {
    if (!content) return '';

    // If it looks like it's already HTML, return as is
    // This is a simple check for common tags
    const htmlPattern = /<(br|p|div|b|i|strong|em|ul|li|ol|h[1-6])\s*\/?>/i;
    if (htmlPattern.test(content)) {
        return content;
    }

    // Process plain text:
    // 1. Trim whitespace
    let formatted = content.trim();

    // 2. Escape HTML special characters to prevent injection
    // but we want to allow {{tags}} so we'll be careful if needed
    // For now, let's just do basic escaping for safety
    formatted = formatted
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    // 3. Convert double newlines to paragraph breaks
    formatted = formatted.split(/\n\s*\n/).map(para => {
        // 4. Convert single newlines within paragraphs to line breaks
        const lines = para.split('\n').join('<br />');
        return `<p style="margin-bottom: 1em;">${lines}</p>`;
    }).join('');

    return formatted;
};
