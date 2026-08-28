# V1 Markdown QA Fixture

## Heading 2

### Heading 3

#### Heading 4

##### Heading 5

###### Heading 6

This paragraph contains **bold**, _italic_, ~~strikethrough~~, _**nested emphasis**_, **bold with _italic_**, `inline code`, and escaped \*Markdown\*.

Blank lines surround this paragraph. Unicode: café, Ελληνικά, हिंदी, 日本語. Emoji: 🧰 ✅ 🚀.

```text
plain fenced code
with a very long line: abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz
```

```ts
const greeting: string = 'Hello, Markdown Toolkit'
console.log(greeting)
```

- Unordered one
- Unordered two
    - Nested unordered
        1. Deep ordered item

1. Ordered one
2. Ordered two
    - Mixed nested item

- [x] Completed task
- [ ] Open task

> A blockquote
>
> > A nested blockquote

[Example link](https://example.com/path?query=value#fragment) and <https://example.com/autolink>.

---

| Feature   | State | Notes                                                                          |
| --------- | :---: | ------------------------------------------------------------------------------ |
| Tables    |  ✅   | GFM table                                                                      |
| Long cell | Ready | abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz |

![Responsive image](https://example.com/markdown-toolkit.png)

Very long URL: https://example.com/a/really/long/path/that/keeps/going/without/a/convenient/place/to/wrap?first=abcdefghijklmnopqrstuvwxyz&second=abcdefghijklmnopqrstuvwxyz&third=abcdefghijklmnopqrstuvwxyz

Long unbroken string: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

Long paragraph: Markdown Toolkit should remain readable when a paragraph contains enough text to wrap across many lines. This fixture deliberately repeats ordinary prose so manual verification can confirm that the preview measure, line height, vertical rhythm, and pane scrolling remain comfortable without introducing page-level horizontal overflow or disrupting the editor and preview layout at different split ratios.

Mixed indentation:

- two spaces
- three spaces - tab indentation

Malformed but recoverable Markdown: **unclosed bold, [incomplete link](, `unclosed code, and ###heading without a separating space.
