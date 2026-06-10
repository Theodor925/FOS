import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { Receipts } from "./pages/Receipts";
import { OutgoingInvoices } from "./pages/OutgoingInvoices";
import { Accounting } from "./pages/Accounting";
import { Clients } from "./pages/Clients";
import { Insights } from "./pages/Insights";
import { Settings } from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registrieren" element={<Register />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/belege" element={<Receipts />} />
        <Route path="/rechnungen" element={<OutgoingInvoices />} />
        <Route path="/buchhaltung" element={<Accounting />} />
        <Route path="/kunden" element={<Clients />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/einstellungen" element={<Settings />} />
      </Route>
    </Routes>
  );
}
