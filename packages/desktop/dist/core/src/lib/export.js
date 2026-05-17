export function exportAsJson(conversation) {
    return JSON.stringify(conversation, null, 2);
}
export function exportAsMarkdown(conversation) {
    const lines = [`# ${conversation.title}`, ''];
    for (const msg of conversation.messages) {
        const role = msg.role === 'user'
            ? '**User**'
            : msg.role === 'assistant'
                ? '**Assistant**'
                : msg.role === 'system'
                    ? '**System**'
                    : '**Tool Result**';
        const ts = new Date(msg.timestamp).toLocaleString();
        lines.push(`### ${role} — ${ts}`, '');
        if (msg.content)
            lines.push(msg.content, '');
        if (msg.toolCalls?.length) {
            for (const tc of msg.toolCalls) {
                lines.push(`> **Tool call:** \`${tc.name}\``);
                lines.push('> ```json');
                lines.push('> ' + JSON.stringify(tc.input, null, 2).replace(/\n/g, '\n> '));
                lines.push('> ```');
                if (tc.result !== undefined) {
                    lines.push(`> **Result:** ${String(tc.result)}`);
                }
                lines.push('');
            }
        }
    }
    return lines.join('\n');
}
export function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
//# sourceMappingURL=export.js.map