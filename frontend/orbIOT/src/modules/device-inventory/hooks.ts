import { useCallback, useEffect, useState } from "react";
import type { CrudApi } from "./api";
import type { EntityId } from "./api";

interface CrudHookResult<T, CreateInput, UpdateInput> {
  rows: T[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  reload: () => Promise<void>;
  createOne: (payload: CreateInput) => Promise<T>;
  updateOne: (id: EntityId, payload: UpdateInput) => Promise<T>;
  deleteOne: (id: EntityId) => Promise<void>;
}

function isNetworkFetchError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network request failed")
  );
}

export function useCrudResource<
  T extends { id: EntityId },
  CreateInput = Partial<T>,
  UpdateInput = Partial<T>,
>(
  api: CrudApi<T, CreateInput, UpdateInput>,
  options?: { initialRows?: T[]; autoLoad?: boolean }
): CrudHookResult<T, CreateInput, UpdateInput> {
  const [rows, setRows] = useState<T[]>(options?.initialRows ?? []);
  const [loading, setLoading] = useState<boolean>(Boolean(options?.autoLoad ?? true));
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const hasFallbackRows = (options?.initialRows?.length ?? 0) > 0;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.list();
      setRows(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load data";
      if (hasFallbackRows && isNetworkFetchError(message)) {
        setError(null);
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [api, hasFallbackRows]);

  useEffect(() => {
    if (options?.autoLoad === false) {
      setLoading(false);
      return;
    }
    void reload();
  }, [reload, options?.autoLoad]);

  const createOne = useCallback(
    async (payload: CreateInput) => {
      setSaving(true);
      setError(null);
      try {
        const created = await api.create(payload);
        setRows((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Create request failed";
        setError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    },
    [api]
  );

  const updateOne = useCallback(
    async (id: EntityId, payload: UpdateInput) => {
      setSaving(true);
      setError(null);
      try {
        const updated = await api.update(id, payload);
        setRows((prev) => prev.map((row) => (row.id === id ? updated : row)));
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Update request failed";
        setError(message);
        throw new Error(message);
      } finally {   
        setSaving(false);
      }
    },
    [api]
  );

  const deleteOne = useCallback(
    async (id: EntityId) => {
      setSaving(true);
      setError(null);
      try {
        await api.remove(id);
        setRows((prev) => prev.filter((row) => row.id !== id));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Delete request failed";
        setError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    },
    [api]
  );

  return {
    rows,
    loading,
    saving,
    error,
    reload,
    createOne,
    updateOne,
    deleteOne,
  };
}
