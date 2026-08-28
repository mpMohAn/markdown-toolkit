export const MARKDOWN_SECURITY_CASES = [
	['script tag', '<script>window.__markdownToolkitAttack = true</script>'],
	[
		'inline event handler',
		'<button onclick="window.__markdownToolkitAttack = true">Run</button>',
	],
	['JavaScript link', '[unsafe](javascript:alert(1))'],
	['data link', '[unsafe](data:text/html,<script>alert(1)</script>)'],
	['unsafe data image', '![unsafe](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'],
	['iframe', '<iframe src="https://example.com"></iframe>'],
	['object', '<object data="https://example.com/file"></object>'],
	['embed', '<embed src="https://example.com/file">'],
	['style injection', '<style>body { display: none }</style>'],
	['malformed HTML', '<div><img src=x onerror=alert(1)><script>alert(2)'],
	[
		'nested malicious markup',
		'<blockquote><a href="javascript:alert(1)"><img src=x onerror=alert(2)></a></blockquote>',
	],
	['Markdown image event payload', '![x](https://example.com/x.png "onerror=alert(1)")'],
] as const

export const COMBINED_SECURITY_MARKDOWN = MARKDOWN_SECURITY_CASES.map(([, value]) => value).join(
	'\n\n',
)
