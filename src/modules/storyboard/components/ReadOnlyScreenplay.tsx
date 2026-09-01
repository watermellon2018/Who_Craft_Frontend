import React, {forwardRef, useMemo} from 'react';
import type {HTMLAttributes, Ref} from 'react';

import type {ScriptBlock} from '../../../page/script/types';
import {sourceLayout} from '../sourceLayout';
import {splitSourceText} from '../sourceSelection';
import type {SourceRange} from '../sourceSelection';

interface ReadOnlyScreenplayProps extends Omit<HTMLAttributes<HTMLDivElement>,
  'children' | 'contentEditable' | 'dangerouslySetInnerHTML'> {
  text: string;
  scriptBlocks?: readonly ScriptBlock[];
  ranges?: readonly SourceRange[];
  firstHighlightRef?: Ref<HTMLElement>;
}

const EMPTY_RANGES: readonly SourceRange[] = [];

/** The DOM keeps the exact source text so selections and saved offsets stay aligned. */
const ReadOnlyScreenplay = forwardRef<HTMLDivElement, ReadOnlyScreenplayProps>(function ReadOnlyScreenplay({
  text, scriptBlocks, ranges = EMPTY_RANGES, firstHighlightRef, className = '', ...props
}, ref) {
  const blocks = useMemo(() => sourceLayout(text, scriptBlocks).map((block) => {
    const length = Array.from(block.text).length;
    return {...block, parts: splitSourceText(block.text, ranges.map((range) => ({
      start: Math.max(0, range.start - block.start),
      end: Math.min(length, range.end - block.start),
    })))};
  }), [ranges, scriptBlocks, text]);
  const formatted = blocks.some((block) => block.type);
  const firstStart = blocks.flatMap((block) => block.parts
    .filter((part) => part.highlighted && part.text.trim())
    .map((part) => block.start + part.start))[0];

  return (
    <div
      {...props}
      className={`storyboard-screenplay${formatted ? ' storyboard-screenplay--formatted' : ''} ${className}`.trim()}
      contentEditable={false}
      ref={ref}
    >
      {blocks.map((block) => {
        const content = block.parts.map((part) => part.highlighted ? (
          <mark key={part.start} ref={block.start + part.start === firstStart ? firstHighlightRef : undefined}>
            {part.text}
          </mark>
        ) : <React.Fragment key={part.start}>{part.text}</React.Fragment>);
        return block.type ? (
          <p key={block.start} className={`storyboard-script__block storyboard-script__block--${block.type}`}>
            {content}
          </p>
        ) : <React.Fragment key={block.start}>{content}</React.Fragment>;
      })}
    </div>
  );
});

export default ReadOnlyScreenplay;
