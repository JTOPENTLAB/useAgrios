import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";

import Landing from "@/pages/Landing";
import TrustCenter from "@/pages/TrustCenter";
import HowItWorks from "@/pages/HowItWorks";
import Explore from "@/pages/Explore";
import PublicListing from "@/pages/PublicListing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import AuthCallback from "@/pages/AuthCallback";
import OnboardingShell from "@/pages/onboarding/OnboardingShell";
import OnboardingProfile from "@/pages/onboarding/OnboardingProfile";
import OnboardingKYC from "@/pages/onboarding/OnboardingKYC";
import OnboardingWallet from "@/pages/onboarding/OnboardingWallet";
import OnboardingInvest from "@/pages/onboarding/OnboardingInvest";
import OnboardingSuccess from "@/pages/onboarding/OnboardingSuccess";
import AppShell from "@/pages/AppShell";
import FarmerDashboard from "@/pages/farmer/FarmerDashboard";
import FarmerListings from "@/pages/farmer/FarmerListings";
import NewListing from "@/pages/farmer/NewListing";
import FarmerOffers from "@/pages/farmer/FarmerOffers";
import AiTools from "@/pages/farmer/AiTools";
import FarmerLoans from "@/pages/farmer/FarmerLoans";
import VideoScripts from "@/pages/farmer/VideoScripts";
import BuyerMarketplace from "@/pages/buyer/BuyerMarketplace";
import BuyerHome from "@/pages/buyer/BuyerHome";
import PriceAlerts from "@/pages/buyer/PriceAlerts";
import FarmerEarnings from "@/pages/farmer/FarmerEarnings";
import MarketIntel from "@/pages/MarketIntel";
import InvestorHome from "@/pages/investor/InvestorHome";
import OpportunityMarketplace from "@/pages/investor/OpportunityMarketplace";
import OpportunityDetail from "@/pages/investor/OpportunityDetail";
import InvestmentSuccess from "@/pages/investor/InvestmentSuccess";
import MyInvestments from "@/pages/investor/MyInvestments";
import Referrals from "@/pages/Referrals";
import AdminGrowth from "@/pages/admin/AdminGrowth";
import FirstInvestment from "@/pages/investor/FirstInvestment";
import InvestorPortfolio from "@/pages/investor/InvestorPortfolio";
import AdminOpportunities from "@/pages/admin/AdminOpportunities";
import AdminTrustOps from "@/pages/admin/AdminTrustOps";
import FarmerRaiseFunding from "@/pages/farmer/FarmerRaiseFunding";
import FarmerFundingRequests from "@/pages/farmer/FarmerFundingRequests";
import Digest from "@/pages/Digest";
import Reconcile from "@/pages/admin/Reconcile";
import ProductDetail from "@/pages/buyer/ProductDetail";
import BuyerOrders from "@/pages/buyer/BuyerOrders";
import BuyerPlans from "@/pages/buyer/BuyerPlans";
import SavedListings from "@/pages/buyer/SavedListings";
import OrderDetail from "@/pages/OrderDetail";
import Wallet from "@/pages/Wallet";
import Analytics from "@/pages/Analytics";
import LogisticsJobs from "@/pages/logistics/LogisticsJobs";
import LogisticsEarnings from "@/pages/logistics/LogisticsEarnings";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminDisputes from "@/pages/admin/AdminDisputes";
import AdminLoans from "@/pages/admin/AdminLoans";

const Guard = ({ roles, children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-ink-muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />;
  return children;
};

const RoleHome = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (user.role === "farmer") return <Navigate to="/app/farmer" replace />;
  if (user.role === "buyer") return <Navigate to="/app/home" replace />;
  if (user.role === "investor") return <Navigate to="/app/investor" replace />;
  if (user.role === "logistics") return <Navigate to="/app/jobs" replace />;
  if (user.role === "admin") return <Navigate to="/app/admin" replace />;
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <div className="App">
      <Toaster position="top-right" richColors closeButton />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/trust" element={<TrustCenter />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/listing/:id" element={<PublicListing />} />
            <Route path="/opportunities/:id" element={<OpportunityDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="/onboarding"
              element={
                <Guard>
                  <OnboardingShell />
                </Guard>
              }
            >
              <Route index element={<Navigate to="/onboarding/profile" replace />} />
              <Route path="profile" element={<OnboardingProfile />} />
              <Route path="kyc" element={<OnboardingKYC />} />
              <Route path="wallet" element={<OnboardingWallet />} />
              <Route path="invest" element={<OnboardingInvest />} />
              <Route path="success" element={<OnboardingSuccess />} />
            </Route>
            <Route
              path="/app"
              element={
                <Guard>
                  <AppShell />
                </Guard>
              }
            >
              <Route index element={<RoleHome />} />
              <Route path="farmer" element={<Guard roles={["farmer"]}><FarmerDashboard /></Guard>} />
              <Route path="farmer/listings" element={<Guard roles={["farmer"]}><FarmerListings /></Guard>} />
              <Route path="farmer/listings/new" element={<Guard roles={["farmer"]}><NewListing /></Guard>} />
              <Route path="farmer/offers" element={<Guard roles={["farmer"]}><FarmerOffers /></Guard>} />
              <Route path="farmer/loans" element={<Guard roles={["farmer"]}><FarmerLoans /></Guard>} />
              <Route path="farmer/ai" element={<Guard roles={["farmer"]}><AiTools /></Guard>} />
              <Route path="farmer/videos" element={<Guard roles={["farmer"]}><VideoScripts /></Guard>} />
              <Route path="marketplace" element={<Guard roles={["buyer", "admin"]}><BuyerMarketplace /></Guard>} />
              <Route path="home" element={<Guard roles={["buyer"]}><BuyerHome /></Guard>} />
              <Route path="digest" element={<Digest />} />
              <Route path="admin/reconcile" element={<Guard roles={["admin"]}><Reconcile /></Guard>} />
              <Route path="marketplace/:id" element={<Guard roles={["buyer", "admin"]}><ProductDetail /></Guard>} />
              <Route path="buyer/plans" element={<Guard roles={["buyer"]}><BuyerPlans /></Guard>} />
              <Route path="buyer/saved" element={<Guard roles={["buyer"]}><SavedListings /></Guard>} />
              <Route path="buyer/alerts" element={<Guard roles={["buyer"]}><PriceAlerts /></Guard>} />
              <Route path="farmer/earnings" element={<Guard roles={["farmer"]}><FarmerEarnings /></Guard>} />
              <Route path="market" element={<Guard roles={["buyer", "farmer", "admin"]}><MarketIntel /></Guard>} />
              <Route path="investor" element={<Guard roles={["investor"]}><InvestorHome /></Guard>} />
              <Route path="opportunities" element={<Guard roles={["investor", "admin", "farmer", "buyer"]}><OpportunityMarketplace /></Guard>} />
              <Route path="opportunities/:id" element={<Guard roles={["investor", "admin", "farmer", "buyer"]}><OpportunityDetail /></Guard>} />
              <Route path="portfolio" element={<Guard roles={["investor"]}><InvestorPortfolio /></Guard>} />
              <Route path="my-investments" element={<Guard roles={["investor"]}><MyInvestments /></Guard>} />
              <Route path="first-investment" element={<Guard roles={["investor"]}><FirstInvestment /></Guard>} />
              <Route path="investment-success" element={<Guard roles={["investor"]}><InvestmentSuccess /></Guard>} />
              <Route path="admin/opportunities" element={<Guard roles={["admin"]}><AdminOpportunities /></Guard>} />
              <Route path="admin/trust" element={<Guard roles={["admin"]}><AdminTrustOps /></Guard>} />
              <Route path="admin/growth" element={<Guard roles={["admin"]}><AdminGrowth /></Guard>} />
              <Route path="referrals" element={<Guard><Referrals /></Guard>} />
              <Route path="farmer/fund" element={<Guard roles={["farmer"]}><FarmerRaiseFunding /></Guard>} />
              <Route path="farmer/funding-requests" element={<Guard roles={["farmer"]}><FarmerFundingRequests /></Guard>} />
              <Route path="orders" element={<Guard roles={["farmer", "buyer"]}><BuyerOrders /></Guard>} />
              <Route path="orders/:id" element={<Guard><OrderDetail /></Guard>} />
              <Route path="wallet" element={<Guard><Wallet /></Guard>} />
              <Route path="analytics" element={<Guard><Analytics /></Guard>} />
              <Route path="jobs" element={<Guard roles={["logistics", "admin"]}><LogisticsJobs /></Guard>} />
              <Route path="logistics/earnings" element={<Guard roles={["logistics", "admin"]}><LogisticsEarnings /></Guard>} />
              <Route path="admin" element={<Guard roles={["admin"]}><AdminDashboard /></Guard>} />
              <Route path="admin/users" element={<Guard roles={["admin"]}><AdminUsers /></Guard>} />
              <Route path="admin/loans" element={<Guard roles={["admin"]}><AdminLoans /></Guard>} />
              <Route path="admin/disputes" element={<Guard roles={["admin"]}><AdminDisputes /></Guard>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
