import { Document } from '@langchain/core/documents';

export const formatDocumentsAsString = (documents: Document[]): string =>
  documents.map((doc) => doc.pageContent).join('\n\n');
