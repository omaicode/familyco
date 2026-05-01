<script setup lang="ts">
import type { KnowledgeDocumentItem, KnowledgeRetrieveItem, ProjectListItem } from '@familyco/ui';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Database, FileUp, RefreshCw, Search, Download, Trash2 } from 'lucide-vue-next';

import { uiRuntime } from '../runtime';
import { useI18n } from '../composables/useI18n';
import { parseApiError } from '../utils/api-error';
import { useToast } from '../plugins/toast.plugin';

interface DesktopKnowledgeBinaryStatus {
  installed: boolean;
  path: string;
  platform: string;
  downloadUrl: string;
}

interface DesktopKnowledgeBinaryDownloadResult {
  accepted: boolean;
  installed: boolean;
  path?: string;
  message?: string;
}

type WebBinaryPlatform = 'linux' | 'darwin' | 'win32';

const { t } = useI18n();
const toast = useToast();

const isDesktop = typeof window !== 'undefined' && typeof window.familycoDesktop?.invoke === 'function';

const documents = ref<KnowledgeDocumentItem[]>([]);
const projects = ref<ProjectListItem[]>([]);
const selectedDocumentId = ref<string>('');
const selectedProjectId = ref<string>('');
const selectedStatus = ref<'all' | 'uploaded' | 'indexing' | 'indexed' | 'failed'>('all');
const chunks = ref<Array<{
  id: string;
  chunkIndex: number;
  sectionPath: string | null;
  content: string;
  tokenEstimate: number | null;
}>>([]);

const retrieveForm = reactive({
  query: '',
  topK: 6
});
const retrieveResult = ref<KnowledgeRetrieveItem[]>([]);

const isLoadingDocuments = ref(false);
const isUploading = ref(false);
const isLoadingChunks = ref(false);
const isRetrieving = ref(false);
const indexingDocumentIds = ref(new Set<string>());
const deletingDocumentIds = ref(new Set<string>());
const activeUploadInputKey = ref(0);

const desktopBinaryStatus = ref<DesktopKnowledgeBinaryStatus | null>(null);
const isLoadingBinaryStatus = ref(false);
const isDownloadingBinary = ref(false);
const serverConverterInstalled = ref<boolean | null>(null);
const webBinaryPlatform = ref<WebBinaryPlatform>(detectWebBinaryPlatform());

const selectedDocument = computed(() => documents.value.find((item) => item.id === selectedDocumentId.value) ?? null);
const canRetrieve = computed(() => retrieveForm.query.trim().length > 0);
const shouldShowBinaryPanel = computed(() => serverConverterInstalled.value === false);
const webBinaryDownloadUrl = computed(() => resolveBinaryDownloadUrl(webBinaryPlatform.value));

const refreshDocuments = async (): Promise<void> => {
  isLoadingDocuments.value = true;
  try {
    documents.value = (await uiRuntime.api.listKnowledgeDocuments({
      ...(selectedProjectId.value ? { projectId: selectedProjectId.value } : {}),
      ...(selectedStatus.value !== 'all' ? { status: selectedStatus.value } : {})
    })).items;

    if (selectedDocumentId.value && !documents.value.some((item) => item.id === selectedDocumentId.value)) {
      selectedDocumentId.value = '';
      chunks.value = [];
    }
  } catch (error) {
    const parsed = parseApiError(error);
    toast.error(parsed.message || t('Failed to load knowledge documents.'));
  } finally {
    isLoadingDocuments.value = false;
  }
};

const refreshProjects = async (): Promise<void> => {
  try {
    projects.value = await uiRuntime.api.listProjects();
  } catch {
    projects.value = [];
  }
};

const loadChunks = async (documentId: string): Promise<void> => {
  if (!documentId) {
    chunks.value = [];
    return;
  }

  isLoadingChunks.value = true;
  try {
    chunks.value = (await uiRuntime.api.listKnowledgeChunks(documentId)).items;
  } catch (error) {
    const parsed = parseApiError(error);
    toast.error(parsed.message || t('Failed to load knowledge chunks.'));
  } finally {
    isLoadingChunks.value = false;
  }
};

const onUploadFile = async (event: Event): Promise<void> => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }

  isUploading.value = true;
  try {
    const uploaded = await uiRuntime.api.uploadKnowledgeDocument({
      file,
      filename: file.name,
      ...(selectedProjectId.value ? { projectId: selectedProjectId.value } : {}),
      source: 'upload'
    });
    toast.success(t('Knowledge document uploaded.'));
    selectedDocumentId.value = uploaded.id;
    await refreshDocuments();
    await loadChunks(uploaded.id);
  } catch (error) {
    const parsed = parseApiError(error);
    toast.error(parsed.message || t('Failed to upload knowledge document.'));
  } finally {
    isUploading.value = false;
    activeUploadInputKey.value += 1;
  }
};

const indexDocument = async (documentId: string): Promise<void> => {
  const next = new Set(indexingDocumentIds.value);
  next.add(documentId);
  indexingDocumentIds.value = next;

  try {
    toast.info(t('Indexing started. This may take a few minutes.'), 5000);
    await uiRuntime.api.indexKnowledgeDocument({ documentId });
    toast.success(t('Knowledge indexing completed.'));
    await refreshDocuments();
    if (selectedDocumentId.value === documentId) {
      await loadChunks(documentId);
    }
  } catch (error) {
    const parsed = parseApiError(error);
    toast.error(parsed.message || t('Failed to index knowledge document.'));
  } finally {
    const after = new Set(indexingDocumentIds.value);
    after.delete(documentId);
    indexingDocumentIds.value = after;
  }
};

const deleteDocument = async (document: KnowledgeDocumentItem): Promise<void> => {
  const accepted = window.confirm(t('Delete knowledge document confirm', { name: document.name }));
  if (!accepted) {
    return;
  }

  const next = new Set(deletingDocumentIds.value);
  next.add(document.id);
  deletingDocumentIds.value = next;

  try {
    await uiRuntime.api.deleteKnowledgeDocument(document.id);
    if (selectedDocumentId.value === document.id) {
      selectedDocumentId.value = '';
      chunks.value = [];
    }
    toast.success(t('Knowledge document deleted.'));
    await refreshDocuments();
  } catch (error) {
    const parsed = parseApiError(error);
    toast.error(parsed.message || t('Failed to delete knowledge document.'));
  } finally {
    const after = new Set(deletingDocumentIds.value);
    after.delete(document.id);
    deletingDocumentIds.value = after;
  }
};

const formatStatus = (status: KnowledgeDocumentItem['status']): string => {
  switch (status) {
    case 'uploaded':
      return t('Uploaded');
    case 'indexing':
      return t('Indexing');
    case 'indexed':
      return t('Indexed');
    case 'failed':
      return t('Failed');
    default:
      return status;
  }
};

const runRetrieve = async (): Promise<void> => {
  if (!canRetrieve.value) {
    return;
  }

  isRetrieving.value = true;
  try {
    const response = await uiRuntime.api.retrieveKnowledge({
      query: retrieveForm.query.trim(),
      topK: retrieveForm.topK,
      ...(selectedProjectId.value ? { projectId: selectedProjectId.value } : {}),
      ...(selectedDocumentId.value ? { documentId: selectedDocumentId.value } : {})
    });
    retrieveResult.value = response.items;
  } catch (error) {
    const parsed = parseApiError(error);
    toast.error(parsed.message || t('Failed to retrieve knowledge context.'));
  } finally {
    isRetrieving.value = false;
  }
};

const loadDesktopBinaryStatus = async (): Promise<void> => {
  if (!isDesktop) {
    return;
  }

  isLoadingBinaryStatus.value = true;
  try {
    desktopBinaryStatus.value = await window.familycoDesktop!.invoke(
      'desktop:knowledge:binary:status',
      {}
    ) as DesktopKnowledgeBinaryStatus;
  } catch (error) {
    const parsed = parseApiError(error);
    toast.error(parsed.message || t('Failed to load knowledge converter status.'));
  } finally {
    isLoadingBinaryStatus.value = false;
  }
};

const loadServerConverterStatus = async (): Promise<void> => {
  try {
    const status = await uiRuntime.api.getKnowledgeConverterStatus();
    serverConverterInstalled.value = status.installed;
  } catch (error) {
    serverConverterInstalled.value = null;
    const parsed = parseApiError(error);
    toast.error(parsed.message || t('Failed to load knowledge converter status.'));
  }
};

const downloadDesktopBinary = async (): Promise<void> => {
  if (!isDesktop || isDownloadingBinary.value) {
    return;
  }

  const accepted = window.confirm(t('Download knowledge converter confirm'));
  if (!accepted) {
    return;
  }

  isDownloadingBinary.value = true;
  try {
    const result = await window.familycoDesktop!.invoke(
      'desktop:knowledge:binary:download',
      {}
    ) as DesktopKnowledgeBinaryDownloadResult;

    if (!result.accepted || !result.installed || !result.path) {
      throw new Error(result.message || 'KNOWLEDGE_BINARY_DOWNLOAD_FAILED');
    }

    await uiRuntime.stores.settings.upsert({
      key: 'knowledge.converter.binaryPath',
      value: result.path
    });

    toast.success(t('Knowledge converter downloaded successfully.'));
    await Promise.all([loadDesktopBinaryStatus(), loadServerConverterStatus()]);
  } catch (error) {
    const parsed = parseApiError(error);
    toast.error(parsed.message || t('Failed to download knowledge converter.'));
  } finally {
    isDownloadingBinary.value = false;
  }
};

watch([selectedProjectId, selectedStatus], () => {
  void refreshDocuments();
});

watch(selectedDocumentId, (documentId) => {
  void loadChunks(documentId);
});

onMounted(() => {
  void Promise.all([refreshDocuments(), refreshProjects(), loadDesktopBinaryStatus(), loadServerConverterStatus()]);
});

function detectWebBinaryPlatform(): WebBinaryPlatform {
  if (typeof navigator === 'undefined') {
    return 'linux';
  }

  const platform = navigator.platform.toLowerCase();
  if (platform.includes('win')) {
    return 'win32';
  }
  if (platform.includes('mac') || platform.includes('darwin')) {
    return 'darwin';
  }
  return 'linux';
}

function resolveBinaryDownloadUrl(platform: WebBinaryPlatform): string {
  switch (platform) {
    case 'linux':
      return 'https://github.com/omaicode/familyco-py/releases/latest/download/familyco-py-linux-x64';
    case 'darwin':
      return 'https://github.com/omaicode/familyco-py/releases/latest/download/familyco-py-macos-x64';
    case 'win32':
      return 'https://github.com/omaicode/familyco-py/releases/latest/download/familyco-py-windows-x64.exe';
  }
}
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>{{ t('Knowledge') }}</h3>
        <p>{{ t('Manage internal document knowledge for retrieval-augmented agent context.') }}</p>
      </div>
      <button class="fc-btn-primary" :disabled="isLoadingDocuments" @click="refreshDocuments">
        <RefreshCw :size="14" :class="{ 'fc-spin': isLoadingDocuments }" />
        {{ isLoadingDocuments ? t('Refreshing…') : t('Refresh') }}
      </button>
    </div>

    <article
      v-if="shouldShowBinaryPanel"
      class="fc-warning"
      style="margin-bottom: 14px;"
    >
      <Download :size="16" />
      <div style="display:flex;flex-direction:column;gap:6px;">
        <strong>{{ t('Knowledge converter is required before indexing documents.') }}</strong>
        <span v-if="isDesktop">{{ t('Download familyco-py from official release to enable document conversion.') }}</span>
        <span v-else>{{ t('For web runtime, place familyco-py in server bin/ (default) or configure binary path manually.') }}</span>
        <div v-if="isDesktop">
          <button class="fc-btn-secondary" :disabled="isDownloadingBinary || isLoadingBinaryStatus" @click="downloadDesktopBinary">
            {{ isDownloadingBinary ? t('Downloading…') : t('Download converter') }}
          </button>
        </div>
        <div v-else class="knowledge-download-row">
          <select v-model="webBinaryPlatform" class="fc-input">
            <option value="linux">Linux x64</option>
            <option value="darwin">macOS x64</option>
            <option value="win32">Windows x64</option>
          </select>
          <a class="fc-btn-secondary" :href="webBinaryDownloadUrl" target="_blank" rel="noopener noreferrer">
            {{ t('Download converter') }}
          </a>
        </div>
      </div>
    </article>

    <div class="knowledge-grid">
      <article class="fc-card">
        <h4 class="fc-card-title">{{ t('Upload and index') }}</h4>
        <p class="fc-list-meta">{{ t('Upload internal files and index them into retrievable chunks.') }}</p>
        <p class="fc-list-meta">{{ t('Tip: Upload a document, click Index, then use Retrieve context.') }}</p>

        <div class="knowledge-filters">
          <select v-model="selectedProjectId" class="fc-input">
            <option value="">{{ t('All projects') }}</option>
            <option v-for="project in projects" :key="project.id" :value="project.id">
              {{ project.name }}
            </option>
          </select>
          <select v-model="selectedStatus" class="fc-input">
            <option value="all">{{ t('All statuses') }}</option>
            <option value="uploaded">{{ t('Uploaded') }}</option>
            <option value="indexing">{{ t('Indexing') }}</option>
            <option value="indexed">{{ t('Indexed') }}</option>
            <option value="failed">{{ t('Failed') }}</option>
          </select>
        </div>

        <label class="knowledge-upload">
          <FileUp :size="16" />
          <span>{{ isUploading ? t('Uploading…') : t('Select document') }}</span>
          <input
            :key="activeUploadInputKey"
            type="file"
            :disabled="isUploading"
            @change="onUploadFile"
          />
        </label>

        <div v-if="documents.length === 0" class="fc-empty">
          <Database :size="20" class="fc-empty-icon" />
          <h4>{{ t('No knowledge documents yet') }}</h4>
          <p>{{ t('Upload your first document to begin building retrieval context.') }}</p>
        </div>

        <table v-else class="fc-budget-table">
          <thead>
            <tr>
              <th>{{ t('Document') }}</th>
              <th>{{ t('Status') }}</th>
              <th>{{ t('Actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="document in documents" :key="document.id">
              <td>
                <div style="display:flex;flex-direction:column;gap:4px;">
                  <strong>{{ document.name }}</strong>
                  <span class="fc-list-meta">{{ document.fileType }} · {{ document.source }}</span>
                </div>
              </td>
              <td>
                <span class="fc-list-meta">{{ formatStatus(document.status) }}</span>
              </td>
              <td>
                <div class="fc-inline-actions">
                  <button class="fc-btn-secondary" @click="selectedDocumentId = document.id">
                    {{ t('View') }}
                  </button>
                  <button
                    class="fc-btn-secondary"
                    :disabled="indexingDocumentIds.has(document.id) || document.status === 'indexing'"
                    @click="indexDocument(document.id)"
                  >
                    {{ indexingDocumentIds.has(document.id) ? t('Indexing…') : t('Index') }}
                  </button>
                  <button
                    class="fc-btn-secondary"
                    :disabled="deletingDocumentIds.has(document.id) || indexingDocumentIds.has(document.id)"
                    @click="deleteDocument(document)"
                  >
                    <Trash2 :size="14" />
                    {{ deletingDocumentIds.has(document.id) ? t('Deleting…') : t('Delete') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </article>

      <article class="fc-card">
        <h4 class="fc-card-title">{{ t('Chunks preview') }}</h4>
        <p class="fc-list-meta">
          {{ selectedDocument ? selectedDocument.name : t('Select a document to inspect indexed chunks.') }}
        </p>

        <div v-if="isLoadingChunks" class="fc-loading">
          {{ t('Loading chunks…') }}
        </div>
        <div v-else-if="!selectedDocumentId" class="fc-empty">
          <h4>{{ t('No document selected') }}</h4>
          <p>{{ t('Pick a document from the list to view chunks.') }}</p>
        </div>
        <div v-else-if="chunks.length === 0" class="fc-empty">
          <h4>{{ t('No chunks available') }}</h4>
          <p>{{ t('Run indexing to generate chunks for this document.') }}</p>
        </div>
        <ul v-else class="knowledge-chunk-list">
          <li v-for="chunk in chunks.slice(0, 20)" :key="chunk.id">
            <div class="knowledge-chunk-head">
              <strong>#{{ chunk.chunkIndex }}</strong>
              <span class="fc-list-meta">{{ chunk.sectionPath || t('No section') }} · {{ chunk.tokenEstimate ?? 0 }} tok</span>
            </div>
            <p>{{ chunk.content }}</p>
          </li>
        </ul>
      </article>
    </div>

    <article class="fc-card" style="margin-top: 14px;">
      <h4 class="fc-card-title">{{ t('Retrieve context') }}</h4>
      <p class="fc-list-meta">{{ t('Test semantic retrieval before it is injected into agent prompts.') }}</p>

      <div class="knowledge-retrieve-form">
        <input
          v-model="retrieveForm.query"
          class="fc-input"
          type="text"
          :placeholder="t('Ask a question for retrieval…')"
        />
        <input
          v-model.number="retrieveForm.topK"
          class="fc-input"
          type="number"
          min="1"
          max="20"
        />
        <button class="fc-btn-primary" :disabled="isRetrieving || !canRetrieve" @click="runRetrieve">
          <Search :size="14" />
          {{ isRetrieving ? t('Searching…') : t('Retrieve') }}
        </button>
      </div>

      <div v-if="retrieveResult.length === 0" class="fc-empty">
        <h4>{{ t('No retrieval results yet') }}</h4>
        <p>{{ t('Run a query to preview the knowledge context candidates.') }}</p>
      </div>

      <ul v-else class="knowledge-result-list">
        <li v-for="(item, index) in retrieveResult" :key="item.id">
          <div class="knowledge-result-head">
            <strong>[{{ index + 1 }}] {{ item.documentName }}</strong>
            <span class="fc-list-meta">score={{ item.score.toFixed(3) }} · {{ item.sectionPath || t('No section') }}</span>
          </div>
          <p>{{ item.content }}</p>
        </li>
      </ul>
    </article>
  </section>
</template>

<style scoped>
.knowledge-grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 14px;
}

.knowledge-filters {
  display: grid;
  grid-template-columns: 1fr 190px;
  gap: 8px;
  margin: 10px 0;
}

.knowledge-upload {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px dashed var(--fc-border-subtle);
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  margin-bottom: 10px;
}

.knowledge-upload input {
  display: none;
}

.knowledge-download-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.knowledge-chunk-list,
.knowledge-result-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
  max-height: 48vh;
  overflow: auto;
}

.knowledge-chunk-list li,
.knowledge-result-list li {
  border: 1px solid var(--fc-border-subtle);
  border-radius: 10px;
  padding: 10px;
  background: color-mix(in srgb, var(--fc-surface) 86%, var(--fc-bg));
}

.knowledge-chunk-head,
.knowledge-result-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.knowledge-chunk-list p,
.knowledge-result-list p {
  margin: 0;
  white-space: pre-wrap;
  color: var(--fc-text-muted);
}

.knowledge-retrieve-form {
  display: grid;
  grid-template-columns: 1fr 120px auto;
  gap: 8px;
  margin: 12px 0;
}

@media (max-width: 1080px) {
  .knowledge-grid {
    grid-template-columns: 1fr;
  }

  .knowledge-filters,
  .knowledge-retrieve-form {
    grid-template-columns: 1fr;
  }
}
</style>
