'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, Editor as TiptapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

type SaveFn = (pageId: string, title: string, json: unknown) => Promise<number>;
type Status = 'saved' | 'dirty' | 'saving';

const EMPTY = { type: 'doc', content: [{ type: 'paragraph' }] };

export default function Editor(props: {
  pageId: string;
  initialTitle: string;
  initialContent: unknown;
  save: SaveFn;
}) {
  const [title, setTitle] = useState(props.initialTitle);
  const [status, setStatus] = useState<Status>('saved');
  const editorRef = useRef<TiptapEditor | null>(null);
  const titleRef = useRef(props.initialTitle);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const ed = editorRef.current;
    if (!ed) return;
    setStatus('saving');
    try {
      await props.save(props.pageId, titleRef.current, ed.getJSON());
      setStatus('saved');
    } catch {
      setStatus('dirty');
    }
  }, [props]);

  const schedule = useCallback(() => {
    setStatus('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  }, [flush]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: (props.initialContent as object) ?? EMPTY,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      editorRef.current = editor;
      schedule();
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const label =
    status === 'saving' ? 'Сохранение…' : status === 'saved' ? 'Все изменения сохранены' : 'Изменено';

  return (
    <div>
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          titleRef.current = e.target.value;
          schedule();
        }}
        placeholder="Заголовок страницы"
        style={{ fontSize: 26, fontWeight: 700, width: '100%', border: 'none', padding: '4px 0' }}
      />
      <div className="savestate" style={{ marginBottom: 10 }}>{label}</div>
      <div className="editor">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
