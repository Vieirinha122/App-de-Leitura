import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, ExternalLink, Search, Trash2 } from "lucide-react";
import type { Article } from "@/types/domain";
import {
  fetchArticles,
  updateArticleStatus,
} from "@/modules/biblioteca/service";
import { useUIStore } from "@/lib/stores/uiStore";

export default function Salvos() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();
  const [search, setSearch] = useState("");
  const articlesQuery = useQuery({
    queryKey: ["saved-articles", search],
    queryFn: () =>
      fetchArticles({
        status: "saved",
        search: search || undefined,
        page: 1,
        pageSize: 30,
      }),
  });
  const removeMutation = useMutation({
    mutationFn: (article: Article) => updateArticleStatus(article.id, "new"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-articles"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      addToast({ type: "success", title: "Removido dos salvos" });
    },
    onError: () =>
      addToast({
        type: "error",
        title: "Erro",
        message: "Não foi possível atualizar o artigo.",
      }),
  });
  const articles = articlesQuery.data?.data ?? [];

  return (
    <div className="container-wide py-5 sm:py-8">
      <header className="mb-5">
        <h1 className="font-display text-display-lg text-ink-900">Salvos</h1>
        <p className="text-body text-ink-500">
          Artigos que você guardou para ler com calma.
        </p>
      </header>
      <label className="relative mb-5 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          className="input pl-10"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar nos artigos salvos"
        />
      </label>
      {articlesQuery.isLoading ? (
        <p className="py-12 text-center text-ink-500">
          Carregando artigos salvos...
        </p>
      ) : articles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-300 px-6 py-16 text-center">
          <Bookmark className="mx-auto mb-3 h-8 w-8 text-ink-300" />
          <h2 className="font-display text-heading-md text-ink-900">
            Nada salvo ainda
          </h2>
          <p className="mt-2 text-body-sm text-ink-500">
            Guarde artigos na leitura de hoje para encontrá-los aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <article key={article.id} className="card p-4 sm:p-5">
              <div className="flex gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="badge-sage">
                      {article.source?.name ?? "Fonte"}
                    </span>
                    {article.readingTimeMinutes && (
                      <span className="text-caption text-ink-500">
                        {article.readingTimeMinutes} min
                      </span>
                    )}
                  </div>
                  <h2 className="font-display text-heading-md text-ink-900">
                    {article.title}
                  </h2>
                  {article.summary && (
                    <p className="mt-2 line-clamp-2 text-body-sm text-ink-500">
                      {article.summary}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-start gap-1">
                  <a
                    className="btn-ghost !min-h-11 !min-w-11 !p-0"
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Ler ${article.title}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    className="btn-ghost !min-h-11 !min-w-11 !p-0 text-rose-600"
                    onClick={() => removeMutation.mutate(article)}
                    disabled={removeMutation.isPending}
                    aria-label={`Remover ${article.title} dos salvos`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
