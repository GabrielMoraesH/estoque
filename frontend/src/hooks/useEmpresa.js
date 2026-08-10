import useAuth from "./useAuth";

export function useEmpresa() {
  const { empresas, activeEmpresa, setActiveEmpresa } = useAuth();

  return {
    empresas,
    activeEmpresa,
    setActiveEmpresa
  };
}

export default useEmpresa;
