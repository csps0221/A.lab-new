'use client';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function Md({ children, inline = false }) {
  if (inline) {
    // 行內顯示:不產生段落,用在「答案」這類短文字,公式也能正確渲染
    return (
      <span className="md-inline">
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({ children: c }) => <>{c}</> }}>
          {children || ''}
        </ReactMarkdown>
      </span>
    );
  }
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children || ''}
      </ReactMarkdown>
    </div>
  );
}
