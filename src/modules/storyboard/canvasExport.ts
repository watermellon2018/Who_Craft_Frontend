import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import type {StoryboardCanvasDocument} from './canvasModel';
import BlockingArtwork, {canvasDimensions} from './components/BlockingArtwork';

interface CanvasExportOptions {includeMotionGuides?: boolean}

/** Entity identifiers, labels and private reference URLs never enter the exported image. */
export function exportCanvasSvg(document: StoryboardCanvasDocument, options: CanvasExportOptions = {}): string {
  return renderToStaticMarkup(React.createElement(BlockingArtwork, {
    document, responsive: false, includeMotionGuides: options.includeMotionGuides,
  }));
}

export async function exportCanvasPng(document: StoryboardCanvasDocument, options: CanvasExportOptions = {}): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([exportCanvasSvg(document, options)], {type: 'image/svg+xml;charset=utf-8'}));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not render the storyboard composition.'));
      image.src = url;
    });
    const size = canvasDimensions(document.aspectRatio);
    const canvas = window.document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas rendering is not available.');
    context.drawImage(image, 0, 0, size.width, size.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Could not export the storyboard composition.')), 'image/png',
    ));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportCanvasPngDataUrl(document: StoryboardCanvasDocument): Promise<string> {
  const blob = await exportCanvasPng(document);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result) : reject(new Error('Could not read the composition image.'));
    reader.onerror = () => reject(new Error('Could not read the composition image.'));
    reader.readAsDataURL(blob);
  });
}
