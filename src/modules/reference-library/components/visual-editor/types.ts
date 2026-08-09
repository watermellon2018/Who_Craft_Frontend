import type {ReferenceCategory} from '../../types';

export type VisualReferenceType = ReferenceCategory;

export type VisualInspectorTab = 'main' | 'appearance' | 'relations';

export type VisualRelationKind = 'character' | 'location';

interface GeneratedVisualAsset {
  createdAt: string;
  id: string;
  imageUrl: string;
  jobId: string;
  name: string;
  prompt?: string;
  source: 'generated';
  variantId: string;
}

export interface GeneratedVisualPreview extends GeneratedVisualAsset {
  isSavedToDrafts: false;
}

export interface UploadedVisualImage {
  createdAt: string;
  file: File;
  id: string;
  imageUrl: string;
  name: string;
  source: 'uploaded';
  uploaded: boolean;
}

export type VisualReferenceDraft = GeneratedVisualAsset | UploadedVisualImage;

export type VisualCanvasImage = GeneratedVisualPreview | VisualReferenceDraft;

export interface VisualRelation {
  id: string;
  kind: VisualRelationKind;
  name: string;
}

export interface VisualRelationCandidate {
  id: string;
  kind: VisualRelationKind;
  name: string;
}

export const VISUAL_REFERENCE_TYPE_ORDER: VisualReferenceType[] = [
  'location',
  'prop',
  'wardrobe',
  'vehicle',
  'symbol',
  'other',
];

export const TITLE_PLACEHOLDER_KEYS: Record<VisualReferenceType, string> = {
  location: 'referenceLibrary.editor.placeholders.title.location',
  other: 'referenceLibrary.editor.placeholders.title.other',
  prop: 'referenceLibrary.editor.placeholders.title.prop',
  symbol: 'referenceLibrary.editor.placeholders.title.symbol',
  vehicle: 'referenceLibrary.editor.placeholders.title.vehicle',
  wardrobe: 'referenceLibrary.editor.placeholders.title.wardrobe',
};

export const CONTINUITY_LABEL_KEYS: Record<VisualReferenceType, string> = {
  location: 'referenceLibrary.editor.fields.locationDetails',
  other: 'referenceLibrary.editor.fields.continuity',
  prop: 'referenceLibrary.editor.fields.continuity',
  symbol: 'referenceLibrary.editor.fields.continuity',
  vehicle: 'referenceLibrary.editor.fields.vehicleDetails',
  wardrobe: 'referenceLibrary.editor.fields.wardrobeDetails',
};
