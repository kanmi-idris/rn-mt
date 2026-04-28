import Link from "next/link";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CodeBlock } from "./code-block";

import { toSlugId } from "../lib/docs";

import type { Components } from "react-markdown";

function flattenNodeText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }

      if (React.isValidElement(child)) {
        const props = child.props as {
          children?: React.ReactNode;
        };
        return flattenNodeText(props.children);
      }

      return "";
    })
    .join("");
}

const markdownComponents: Components = {
  a({ node: _node, href = "", ...props }) {
    if (href.startsWith("/")) {
      return <Link href={href}>{props.children}</Link>;
    }

    return (
      <a href={href} {...props} target="_blank" rel="noreferrer">
        {props.children}
      </a>
    );
  },
  h1(props) {
    const text = flattenNodeText(props.children);
    return <h1 id={toSlugId(text)}>{props.children}</h1>;
  },
  h2(props) {
    const text = flattenNodeText(props.children);
    return <h2 id={toSlugId(text)}>{props.children}</h2>;
  },
  h3(props) {
    const text = flattenNodeText(props.children);
    return <h3 id={toSlugId(text)}>{props.children}</h3>;
  },
  pre({ node: _node, ...props }) {
    return <>{props.children}</>;
  },
  code({ node: _node, ...props }) {
    const className = props.className ?? "";
    const isInline = !className;
    const language = className.replace(/^language-/, "") || null;
    const rawCode = flattenNodeText(props.children).replace(/\n$/, "");

    if (!isInline) {
      return <CodeBlock code={rawCode} language={language} />;
    }

    return (
      <code
        {...props}
        className={isInline ? "docs-markdown__inline-code" : className}
      />
    );
  },
  table({ node: _node, ...props }) {
    return (
      <div className="docs-markdown__table-wrap">
        <table {...props} />
      </div>
    );
  },
};

type DocMarkdownProps = {
  content: string;
};

export function DocMarkdown({ content }: DocMarkdownProps) {
  return (
    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
      {content}
    </ReactMarkdown>
  );
}
