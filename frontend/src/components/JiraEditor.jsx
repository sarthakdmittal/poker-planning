import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { TextAlign } from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import './JiraEditor.css';

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6];

function ToolbarButton({ onClick, active, title, children, disabled }) {
  return (
    <button
      type="button"
      className={`je-btn ${active ? 'je-btn--active' : ''}`}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="je-divider" />;
}

export default function JiraEditor({ content, onChange, placeholder = 'Add content…' }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: HEADING_LEVELS },
        codeBlock: { HTMLAttributes: { class: 'je-code-block' } },
        blockquote: { HTMLAttributes: { class: 'je-blockquote' } },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'je-link' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('URL', prev);
    if (url === null) return;
    if (url === '') { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url }).run();
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const canAddCol = editor.can().addColumnAfter?.() ?? false;
  const canAddRow = editor.can().addRowAfter?.() ?? false;
  const isInTable = editor.isActive('table');

  return (
    <div className="je-wrapper">
      <div className="je-toolbar">
        {/* Text style */}
        <select
          className="je-heading-select"
          value={
            HEADING_LEVELS.find(l => editor.isActive('heading', { level: l }))
              ? `h${HEADING_LEVELS.find(l => editor.isActive('heading', { level: l }))}`
              : 'p'
          }
          onChange={e => {
            const val = e.target.value;
            if (val === 'p') editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: parseInt(val[1]) }).run();
          }}
        >
          <option value="p">Normal</option>
          {HEADING_LEVELS.map(l => (
            <option key={l} value={`h${l}`}>Heading {l}</option>
          ))}
        </select>

        <Divider />

        {/* Inline formatting */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
          <b>B</b>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
          <i>I</i>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)">
          <u>U</u>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <s>S</s>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">
          {'</>'}
        </ToolbarButton>

        <Divider />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          ≡•
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
          1.
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList?.().run()} active={editor.isActive('taskList')} title="Task list">
          ☑
        </ToolbarButton>

        <Divider />

        {/* Alignment */}
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
          ⇐
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Center">
          ≡
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
          ⇒
        </ToolbarButton>

        <Divider />

        {/* Block */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          "
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">
          {'{ }'}
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Horizontal rule">
          —
        </ToolbarButton>

        <Divider />

        {/* Link */}
        <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Link">
          🔗
        </ToolbarButton>

        {/* Table */}
        <ToolbarButton onClick={insertTable} active={false} title="Insert table">
          ⊞
        </ToolbarButton>
        {isInTable && (
          <>
            <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} active={false} title="Add column" disabled={!canAddCol}>+col</ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} active={false} title="Add row" disabled={!canAddRow}>+row</ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} active={false} title="Delete table">✕tbl</ToolbarButton>
          </>
        )}

        <Divider />

        {/* Undo / Redo */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} active={false} title="Undo (Ctrl+Z)" disabled={!editor.can().undo()}>
          ↩
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} active={false} title="Redo (Ctrl+Y)" disabled={!editor.can().redo()}>
          ↪
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} className="je-content" />
    </div>
  );
}
