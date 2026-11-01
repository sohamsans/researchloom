import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Table as TableIcon,
  Sigma,
  Minus,
  RotateCcw,
  RotateCw,
  BookOpen,
  Download,
  Printer,
  FileText,
  Clock,
  Sparkles,
  Maximize2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { marked } from 'marked';
import katex from 'katex';

interface RichDocEditorProps {
  content: string;
  onChange: (val: string) => void;
  title: string;
  onTitleChange: (val: string) => void;
  onOpenCitationPicker: () => void;
  onExport: (format: 'md' | 'html' | 'txt') => void;
  isSaving?: boolean;
  lastSaved?: string;
  citationToInsert?: string | null;
  onCitationInserted?: () => void;
}

export const RichDocEditor: React.FC<RichDocEditorProps> = ({
  content,
  onChange,
  title,
  onTitleChange,
  onOpenCitationPicker,
  onExport,
  isSaving,
  lastSaved,
  citationToInsert,
  onCitationInserted
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif' | 'mono'>('serif');
  const [fontSize, setFontSize] = useState<string>('12pt');
  const [activeFormat, setActiveFormat] = useState<string>('p');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [wordCount, setWordCount] = useState<number>(0);
  const [charCount, setCharCount] = useState<number>(0);
  const isInternalUpdate = useRef(false);

  // Initialize or synchronize content in editor
  useEffect(() => {
    if (!editorRef.current) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }

    let initialHtml = content;
    // If incoming content is raw markdown, convert it to clean rich HTML
    if (content.includes('# ') || content.includes('## ') || content.includes('|---|') || content.startsWith('#')) {
      try {
        initialHtml = marked.parse(content, { breaks: true, gfm: true }) as string;
      } catch {
        initialHtml = content;
      }
    }

    if (editorRef.current.innerHTML !== initialHtml) {
      editorRef.current.innerHTML = initialHtml || '<p>Start writing your academic paper or research note here...</p>';
      updateStats();
    }
  }, [content]);

  // Insert citation when passed from modal
  useEffect(() => {
    if (citationToInsert && editorRef.current) {
      editorRef.current.focus();
      const pillHtml = `<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-medium mx-1 select-none" contenteditable="false">${citationToInsert}</span>&nbsp;`;
      executeCommand('insertHTML', pillHtml);
      if (onCitationInserted) onCitationInserted();
    }
  }, [citationToInsert, onCitationInserted]);

  const updateStats = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
    setCharCount(text.length);
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    isInternalUpdate.current = true;
    const html = editorRef.current.innerHTML;
    onChange(html);
    updateStats();
  };

  // Standard Document Command Execution
  const executeCommand = (command: string, value: string | undefined = undefined) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    handleInput();
  };

  const handleFormatBlock = (tag: string) => {
    setActiveFormat(tag);
    executeCommand('formatBlock', `<${tag}>`);
  };

  const insertTable = () => {
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #3f3f46;">
        <thead>
          <tr style="background-color: #27272a; border-bottom: 2px solid #52525b;">
            <th style="border: 1px solid #3f3f46; padding: 8px 12px; text-align: left; font-weight: 600;">Method / Parameter</th>
            <th style="border: 1px solid #3f3f46; padding: 8px 12px; text-align: center; font-weight: 600;">Baseline (SOTA)</th>
            <th style="border: 1px solid #3f3f46; padding: 8px 12px; text-align: center; font-weight: 600;">Proposed Result</th>
            <th style="border: 1px solid #3f3f46; padding: 8px 12px; text-align: right; font-weight: 600;">Delta (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #3f3f46; padding: 8px 12px;">Accuracy / F1</td>
            <td style="border: 1px solid #3f3f46; padding: 8px 12px; text-align: center;">89.4%</td>
            <td style="border: 1px solid #3f3f46; padding: 8px 12px; text-align: center; color: #34d399; font-weight: 500;">94.8%</td>
            <td style="border: 1px solid #3f3f46; padding: 8px 12px; text-align: right; color: #34d399;">+5.4%</td>
          </tr>
          <tr>
            <td style="border: 1px solid #3f3f46; padding: 8px 12px;">Inference Latency</td>
            <td style="border: 1px solid #3f3f46; padding: 8px 12px; text-align: center;">32.0 ms</td>
            <td style="border: 1px solid #3f3f46; padding: 8px 12px; text-align: center; color: #34d399; font-weight: 500;">14.2 ms</td>
            <td style="border: 1px solid #3f3f46; padding: 8px 12px; text-align: right; color: #34d399;">-55.6%</td>
          </tr>
        </tbody>
      </table>
      <p><br></p>
    `;
    executeCommand('insertHTML', tableHtml);
  };

  const insertMathFormula = () => {
    const mathTex = '\\mathcal{L}_{\\text{total}} = \\lambda_1 \\mathcal{L}_{\\text{task}} + \\lambda_2 \\mathcal{L}_{\\text{reg}}';
    try {
      const rendered = katex.renderToString(mathTex, { displayMode: true, throwOnError: false });
      const mathHtml = `<div class="katex-block my-4 py-3 text-center bg-zinc-950 border border-zinc-800 rounded-lg select-none" contenteditable="false">${rendered}</div><p><br></p>`;
      executeCommand('insertHTML', mathHtml);
    } catch {
      executeCommand('insertHTML', `<p>$$${mathTex}$$</p>`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="flex flex-col h-full bg-[#0c0d10] text-zinc-100 overflow-hidden select-none">
      {/* 1. Top Ribbon Header (Document Title & File Actions) */}
      <div className="px-6 py-2.5 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Document Title (e.g. Literature Review Synthesis)"
              className="bg-transparent border-none text-sm font-semibold text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-0 w-full min-w-0 tracking-tight"
            />
          </div>
        </div>

        {/* Status, Print & Export */}
        <div className="flex items-center gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isSaving ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span className="text-[11px] font-mono">
              {isSaving ? 'Saving...' : lastSaved ? `Saved ${lastSaved}` : 'SQLite Vault'}
            </span>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
            title="Print or Save as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* Export Dropdown */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => onExport('html')}
              className="px-2 py-0.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition cursor-pointer"
              title="Export as HTML / Word Web Page"
            >
              .DOC
            </button>
            <button
              type="button"
              onClick={() => onExport('md')}
              className="px-2 py-0.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition cursor-pointer"
              title="Export as Markdown"
            >
              .MD
            </button>
            <button
              type="button"
              onClick={() => onExport('txt')}
              className="px-2 py-0.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition cursor-pointer"
              title="Export as Plain Text"
            >
              .TXT
            </button>
          </div>
        </div>
      </div>

      {/* 2. Google Docs / Microsoft Word Ribbon Toolbar */}
      <div className="px-6 py-1.5 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none text-zinc-300 text-xs">
        {/* Undo / Redo */}
        <button
          type="button"
          onClick={() => executeCommand('undo')}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Undo (Ctrl+Z)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('redo')}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Redo (Ctrl+Y)"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-zinc-800 mx-1 shrink-0" />

        {/* Style Dropdown (Heading 1, 2, 3, Paragraph) */}
        <select
          value={activeFormat}
          onChange={(e) => handleFormatBlock(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-hidden focus:border-zinc-700 cursor-pointer"
          title="Paragraph Style"
        >
          <option value="p">Normal Text</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>

        {/* Font Family Dropdown */}
        <select
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value as any)}
          className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-hidden focus:border-zinc-700 cursor-pointer"
          title="Document Typography"
        >
          <option value="serif">Times / Georgia (Academic)</option>
          <option value="sans">Inter / Arial (Modern)</option>
          <option value="mono">Courier / Mono (Technical)</option>
        </select>

        <div className="w-px h-4 bg-zinc-800 mx-1 shrink-0" />

        {/* Basic In-line Styling: B, I, U, S */}
        <button
          type="button"
          onClick={() => executeCommand('bold')}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition font-bold cursor-pointer"
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('italic')}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition cursor-pointer"
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('underline')}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition cursor-pointer"
          title="Underline (Ctrl+U)"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('strikeThrough')}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition cursor-pointer"
          title="Strikethrough"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-zinc-800 mx-1 shrink-0" />

        {/* Alignment */}
        <button
          type="button"
          onClick={() => executeCommand('justifyLeft')}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Align Left"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('justifyCenter')}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Align Center"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('justifyRight')}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Align Right"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('justifyFull')}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Justify"
        >
          <AlignJustify className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-zinc-800 mx-1 shrink-0" />

        {/* Lists & Indents */}
        <button
          type="button"
          onClick={() => executeCommand('insertUnorderedList')}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Bulleted List"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('insertOrderedList')}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Numbered List"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('outdent')}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Decrease Indent"
        >
          <Outdent className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('indent')}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Increase Indent"
        >
          <Indent className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-zinc-800 mx-1 shrink-0" />

        {/* Inserters: Table, Divider, Formula */}
        <button
          type="button"
          onClick={insertTable}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Insert Academic Comparison Table"
        >
          <TableIcon className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('insertHorizontalRule')}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Insert Horizontal Divider"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={insertMathFormula}
          className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Insert KaTeX Math Formula"
        >
          <Sigma className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-zinc-800 mx-1 shrink-0" />

        {/* Cite Literature Button */}
        <button
          type="button"
          onClick={onOpenCitationPicker}
          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-medium flex items-center gap-1.5 transition ml-auto border border-zinc-700 cursor-pointer shrink-0"
        >
          <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
          <span>Cite Literature</span>
        </button>
      </div>

      {/* 3. Authentic Microsoft Word / Google Docs Canvas Desk */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-10 flex justify-center bg-[#0e0f12]">
        <div
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top center'
          }}
          className="transition-transform duration-100 w-full max-w-[850px]"
        >
          {/* Centered Document Page Sheet */}
          <div
            className={`w-full min-h-[1056px] bg-[#18191b] border border-zinc-800 shadow-2xl p-12 sm:p-16 rounded-sm text-zinc-200 focus:outline-hidden ${
              fontFamily === 'serif'
                ? 'font-serif'
                : fontFamily === 'mono'
                ? 'font-mono'
                : 'font-sans'
            }`}
          >
            {/* Direct In-place Document Title */}
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 mb-6 pb-2 border-b border-zinc-800 tracking-tight leading-tight select-text">
              {title || 'Untitled Academic Note'}
            </h1>

            {/* Direct In-place WYSIWYG Editable Document Body */}
            <div
              ref={editorRef}
              contentEditable
              onInput={handleInput}
              onKeyDown={(e) => {
                // If user types '@', trigger inline citation autocomplete modal
                if (e.key === '@') {
                  e.preventDefault();
                  onOpenCitationPicker();
                }
              }}
              suppressContentEditableWarning
              className="prose prose-invert max-w-none text-zinc-200 focus:outline-hidden leading-relaxed text-sm select-text [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mt-6 [&>h1]:mb-3 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mt-5 [&>h2]:mb-2 [&>h3]:text-base [&>h3]:font-semibold [&>h3]:mt-4 [&>h3]:mb-1.5 [&>p]:my-3 [&>ul]:list-disc [&>ul]:pl-6 [&>ol]:list-decimal [&>ol]:pl-6 [&>table]:w-full [&>table]:my-4"
              style={{ minHeight: '800px' }}
              spellCheck="true"
            />
          </div>
        </div>
      </div>

      {/* 4. Bottom Status Ribbon (like Microsoft Word / Google Docs) */}
      <div className="px-6 py-2 border-t border-zinc-800 bg-zinc-900/80 flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
        <div className="flex items-center gap-4">
          <span>Page 1 of 1</span>
          <span>•</span>
          <span>
            <strong className="text-zinc-300 font-mono">{wordCount}</strong> words
          </span>
          <span>•</span>
          <span>
            <strong className="text-zinc-300 font-mono">{charCount}</strong> characters
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-zinc-500" />
            <span>~{readingTime} min read</span>
          </span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(75, z - 10))}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <span className="font-mono text-zinc-300 text-[10px] w-8 text-center">{zoomLevel}%</span>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3 h-3" />
          </button>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-500 font-medium">WYSIWYG Word Processor</span>
        </div>
      </div>
    </div>
  );
};
