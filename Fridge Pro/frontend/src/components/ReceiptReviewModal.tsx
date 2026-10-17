import { useEffect, useState } from "react";
import { Check, Sparkles, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { ReceiptPreviewItem } from "@/types";

interface ReceiptReviewModalProps {
  isOpen: boolean;
  items: ReceiptPreviewItem[];
  isSaving: boolean;
  onClose: () => void;
  onConfirm: (items: ReceiptPreviewItem[]) => void;
}

// Une ligne est valide si son nom, sa quantité et son unité sont renseignés.
const isValidItem = (item: ReceiptPreviewItem) =>
  item.name.trim().length > 0 && item.quantity > 0 && item.unit.trim().length > 0;

/**
 * Aperçu éditable du ticket scanné : rien n'est ajouté au frigo tant que
 * l'utilisateur n'a pas confirmé (il peut corriger ou supprimer des lignes).
 */
export function ReceiptReviewModal({
  isOpen,
  items,
  isSaving,
  onClose,
  onConfirm,
}: ReceiptReviewModalProps) {
  const [draft, setDraft] = useState<ReceiptPreviewItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setDraft(items.map((item) => ({ ...item })));
    }
  }, [isOpen, items]);

  const updateItem = (index: number, patch: Partial<ReceiptPreviewItem>) => {
    setDraft((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  };

  const removeItem = (index: number) => {
    setDraft((current) => current.filter((_, i) => i !== index));
  };

  const validCount = draft.filter(isValidItem).length;
  const allValid = draft.length > 0 && validCount === draft.length;

  const handleConfirm = () => {
    if (!allValid) return;
    onConfirm(
      draft.map((item) => ({
        ...item,
        name: item.name.trim(),
        unit: item.unit.trim(),
      }))
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Vérifier le ticket scanné"
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 text-xs sm:text-sm text-emerald-900 bg-emerald-50 border border-emerald-200/60 rounded-xl p-3">
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
          <p>
            Voici ce que l'IA a détecté. Corrigez les quantités si besoin
            (ex&nbsp;: 200 g → 400 g), modifiez un nom ou supprimez une ligne.
            Rien n'est encore ajouté au frigo.
          </p>
        </div>

        {draft.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">
            Toutes les lignes ont été supprimées. Annulez, ou supprimez le ticket.
          </p>
        ) : (
          <div className="space-y-3">
            {draft.map((item, index) => {
              const valid = isValidItem(item);
              return (
                <div
                  key={index}
                  className={`rounded-2xl border p-3 space-y-2 ${
                    valid
                      ? "border-gray-200"
                      : "border-red-300 bg-red-50/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                      <span>{item.categoryIcon || "📦"}</span>
                      <span>{item.categoryName || "Sans catégorie"}</span>
                      {item.itemCount > 1 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">
                          ×{item.itemCount}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      aria-label="Supprimer cette ligne"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(index, { name: e.target.value })}
                    placeholder="Nom de l'aliment"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={item.quantity === 0 ? "" : String(item.quantity)}
                      onChange={(e) => {
                        const parsed = parseFloat(
                          e.target.value.replace(",", ".")
                        );
                        updateItem(index, {
                          quantity: isNaN(parsed) ? 0 : parsed,
                        });
                      }}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      aria-label="Quantité"
                    />
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateItem(index, { unit: e.target.value })}
                      placeholder="unité (g, ml, pièce...)"
                      className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      aria-label="Unité"
                    />
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={
                          item.price === null || item.price === undefined
                            ? ""
                            : String(item.price)
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw.trim() === "") {
                            updateItem(index, { price: null });
                            return;
                          }
                          const parsed = parseFloat(raw.replace(",", "."));
                          updateItem(index, {
                            price: isNaN(parsed) ? null : parsed,
                          });
                        }}
                        placeholder="Prix"
                        className="w-full pl-3 pr-7 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        aria-label="Prix en euros"
                      />
                      <span className="absolute right-2.5 top-2 text-gray-400 text-sm pointer-events-none">
                        €
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            {validCount} ligne(s) prête(s) à être ajoutée(s)
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Annuler
            </Button>
            <Button
              type="button"
              loading={isSaving}
              disabled={!allValid}
              onClick={handleConfirm}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Check className="w-4 h-4 mr-1.5" />
              Ajouter au frigo ({validCount})
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
