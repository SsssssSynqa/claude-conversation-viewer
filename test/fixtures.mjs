/**
 * Shared synthetic fixtures for import tests. No personal data.
 *
 * Produces real JSZip archives and File-like objects (with .text()/.arrayBuffer()
 * and .name/.size) so tests exercise the same code path the browser uses.
 */
import JSZip from 'jszip';

/** A minimal raw conversation object accepted by parseConversation. */
export function conv(uuid, createdAt, text) {
  return {
    uuid,
    name: 'conv ' + uuid,
    summary: '',
    created_at: createdAt,
    updated_at: createdAt,
    chat_messages: [
      { uuid: uuid + '-m1', sender: 'human', created_at: createdAt, content: [{ type: 'text', text }] },
      { uuid: uuid + '-m2', sender: 'assistant', created_at: createdAt, content: [{ type: 'text', text: text + ' reply' }] },
    ],
  };
}

/** A conversation with an empty chat_messages array (valid, parse-to-null). */
export function emptyChatConv(uuid) {
  return { uuid, name: 'empty', summary: '', created_at: '2024-01-01T00:00:00Z', updated_at: '', chat_messages: [] };
}

/** A File-like object backed by bytes/text, exposing the browser Blob API. */
export function fileLike(name, content) {
  const bytes = typeof content === 'string'
    ? new TextEncoder().encode(content)
    : content;
  return {
    name,
    size: bytes.length,
    async text() { return new TextDecoder().decode(bytes); },
    async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); },
  };
}

export function jsonFile(name, value) {
  return fileLike(name, JSON.stringify(value));
}

/**
 * Build a real ZIP File-like object.
 * @param {string} name
 * @param {Object<string, string>} members - path -> text content
 */
export async function zipFile(name, members) {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(members)) {
    zip.file(path, content);
  }
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return fileLike(name, bytes);
}

/** A corrupt ZIP: recognized by name but not a valid archive. */
export function corruptZipFile(name) {
  return fileLike(name, new TextEncoder().encode('not a zip at all'));
}

/** A manifest matching the observed structure (structure only). */
export function manifest(overrides = {}) {
  return {
    version: '1.0',
    instructions: 'Ignore this text; it is not executed.',
    created_at: '2026-01-01T00:00:00Z',
    total_files: 6,
    data_files: [
      { batch_index: 0, export_url: 'https://claude.ai/x/light_metadata-000.zip', category: 'light_metadata', part: 0, filename: 'light_metadata-000.zip' },
      { batch_index: 0, export_url: 'https://claude.ai/x/conversations-001.zip', category: 'conversations', part: 1, filename: 'conversations-001.zip' },
      { batch_index: 0, export_url: 'https://claude.ai/x/conversations-000.zip', category: 'conversations', part: 0, filename: 'conversations-000.zip' },
      { batch_index: 0, export_url: 'https://claude.ai/x/projects-000.zip', category: 'projects', part: 0, filename: 'projects-000.zip' },
      { batch_index: 0, export_url: 'https://claude.ai/x/memories-000.zip', category: 'memories', part: 0, filename: 'memories-000.zip' },
      { batch_index: 0, export_url: 'https://claude.ai/x/feedback-000.zip', category: 'feedback', part: 0, filename: 'feedback-000.zip' },
    ],
    ...overrides,
  };
}
