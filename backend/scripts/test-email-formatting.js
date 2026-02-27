import { formatEmailBody } from '../utils/email-formatter.js';

const testCases = [
    {
        name: "Plain text with single newlines",
        input: "Hello,\nHow are you?\nRegards,\nMe",
        expected: '<p style="margin-bottom: 1em;">Hello,<br />How are you?<br />Regards,<br />Me</p>'
    },
    {
        name: "Plain text with double newlines (paragraphs)",
        input: "Hello,\n\nHow are you doing today?\n\nBest regards,\nAntigravity",
        expected: '<p style="margin-bottom: 1em;">Hello,</p><p style="margin-bottom: 1em;">How are you doing today?</p><p style="margin-bottom: 1em;">Best regards,<br />Antigravity</p>'
    },
    {
        name: "Existing HTML content",
        input: "<div>Hello <b>World</b></div>",
        expected: "<div>Hello <b>World</b></div>"
    },
    {
        name: "Empty content",
        input: "",
        expected: ""
    }
];

console.log("Running Email Formatter Tests...\n");

let passed = 0;
testCases.forEach(tc => {
    const result = formatEmailBody(tc.input);
    if (result === tc.expected) {
        console.log(`✅ PASSED: ${tc.name}`);
        passed++;
    } else {
        console.log(`❌ FAILED: ${tc.name}`);
        console.log(`   Expected: ${tc.expected}`);
        console.log(`   Actual:   ${result}`);
    }
});

console.log(`\nTests Completed: ${passed}/${testCases.length} passed.`);

if (passed === testCases.length) {
    process.exit(0);
} else {
    process.exit(1);
}
