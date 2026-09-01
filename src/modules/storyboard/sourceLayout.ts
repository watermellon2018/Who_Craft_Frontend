import type {ScriptBlock, ScriptBlockType} from '../../page/script/types';

interface SourceLayoutPart {
  start: number;
  text: string;
  type?: ScriptBlockType;
}

/** Apply known screenplay formatting only when it describes this exact text.
 * Keep whitespace and Unicode offsets intact for the shot's source highlights.
 */
export function sourceLayout(text: string, blocks: readonly ScriptBlock[] = []): SourceLayoutPart[] {
  const plain = [{start: 0, text}];
  const parts: SourceLayoutPart[] = [];
  let cursor = 0;
  let offset = 0;
  for (const block of blocks) {
    const content = block.text.trim();
    if (!content) continue;
    const start = text.indexOf(content, cursor);
    if (start < 0 || text.slice(cursor, start).trim()) return plain;
    const gap = text.slice(cursor, start);
    if (gap) {
      parts.push({start: offset, text: gap});
      offset += Array.from(gap).length;
    }
    parts.push({start: offset, text: content, type: block.type});
    offset += Array.from(content).length;
    cursor = start + content.length;
  }
  const tail = text.slice(cursor);
  if (!parts.length || tail.trim()) return plain;
  if (tail) parts.push({start: offset, text: tail});
  return parts;
}
