'use client';

import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { oneDark } from '@codemirror/theme-one-dark';

interface CodeMirrorEditorProps {
  value: string;
  filePath: string;
  onChange: (value: string) => void;
}

export function CodeMirrorEditor({ value, filePath, onChange }: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    initialValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Detect language extension
    const getLanguageExtension = (path: string) => {
      const lower = path.toLowerCase();
      if (lower.endsWith('.html') || lower.endsWith('.htm')) return html();
      if (lower.endsWith('.css')) return css();
      if (lower.endsWith('.json')) return javascript();
      return javascript({ jsx: true, typescript: true });
    };

    // Custom dark theme tweaks to blend with NEXA Design Tokens
    const nexaEditorTheme = EditorView.theme({
      '&': {
        height: '100%',
        backgroundColor: '#070A12',
        color: '#E2E8F0',
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: '13px',
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'inherit',
      },
      '.cm-gutters': {
        backgroundColor: '#0B0F19',
        color: '#475569',
        borderRight: '1px solid rgba(255, 255, 255, 0.05)',
      },
      '.cm-activeLine': {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        color: '#94A3B8',
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: '#22D3EE',
        borderLeftWidth: '2px',
      },
      '&.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: 'rgba(124, 92, 255, 0.3) !important',
      },
    });

    const startState = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        getLanguageExtension(filePath),
        oneDark,
        nexaEditorTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newDoc = update.state.doc.toString();
            onChangeRef.current(newDoc);
          }
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [filePath]); // Recreate view when file changes to update language extension

  // Sync external doc updates if value changed from outside
  useEffect(() => {
    if (viewRef.current) {
      const currentDoc = viewRef.current.state.doc.toString();
      if (value !== currentDoc) {
        viewRef.current.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: value },
        });
      }
    }
  }, [value]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
}
