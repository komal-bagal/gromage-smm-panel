import AppRoutes from "./routes/AppRoutes";
import { ToastProvider } from "./components/ui/Toast";
import { LanguageProvider } from "./context/LanguageContext";

function App() {
  return (
    <ToastProvider>
      <LanguageProvider>
        <AppRoutes />
      </LanguageProvider>
    </ToastProvider>
  );
}

export default App;