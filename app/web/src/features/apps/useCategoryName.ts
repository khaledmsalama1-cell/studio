import { useApps } from "./api";
import { categoryName } from "./model";

/** Category names as the app list defines them (cached, so any component can ask) */
export function useCategoryName() {
  const { data } = useApps();
  return (id: string) => categoryName(data?.categories || [], id);
}
