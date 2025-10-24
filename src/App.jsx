import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignUp from './signup.jsx';
import Login from './login.jsx';
import Dashboard from './dashboard.jsx';
import Review from './review.jsx';
import Edit from './edit.jsx';
import Home from './home.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import TextTranslator from './components/TextTranslator.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/login" element={<Login />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/review" 
              element={
                <ProtectedRoute>
                  <Review />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/edit/:id" 
              element={
                <ProtectedRoute>
                  <Edit />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Footer />
          <TextTranslator />
        </div>
      </Router>
    </AuthProvider>
  );
}

// Placeholder Profile component
const Profile = () => {
  return (
    <div className="min-h-screen bg-gray-50 font-hind-siliguri">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Profile</h1>
          <p className="text-gray-600 text-lg">Manage your probad_ profile settings here.</p>
        </div>
      </div>
    </div>
  );
};

export default App;
