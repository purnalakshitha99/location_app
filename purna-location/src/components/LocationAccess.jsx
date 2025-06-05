import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const LocationAccess = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [locationStatus, setLocationStatus] = useState('checking');
  const [isAnimating, setIsAnimating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkLocationAccess();
  }, []);

  useEffect(() => {
    if (showPopup) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [showPopup]);

  const checkLocationAccess = async () => {
    try {
      if (!navigator.geolocation) {
        setLocationStatus('not-supported');
        return;
      }

      const permission = await navigator.permissions.query({ name: 'geolocation' });
      
      if (permission.state === 'granted') {
        setLocationStatus('granted');
        navigate('/');
      } else if (permission.state === 'prompt') {
        setShowPopup(true);
      } else {
        setLocationStatus('denied');
        setShowPopup(true);
      }
    } catch (error) {
      console.error('Error checking location access:', error);
      setLocationStatus('error');
    }
  };

  const requestLocationAccess = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationStatus('granted');
        setShowPopup(false);
        navigate('/');
      },
      (error) => {
        console.error('Error getting location:', error);
        setLocationStatus('denied');
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  };

  if (!showPopup) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Backdrop with blur effect */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 animate-gradient" />
      
      {/* Main popup container */}
      <div 
        className={`relative bg-white/10 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-white/20 transform transition-all duration-500 ${
          isAnimating ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* Decorative elements */}
        <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl" />
        <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl" />
        
        <div className="relative text-center">
          {/* Location icon with glass effect */}
          <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-6 border border-white/20 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          
          <h2 className="text-3xl font-bold text-white mb-3 drop-shadow-lg">
            Location Access Required
          </h2>
          
          <p className="text-white/80 mb-8 text-lg leading-relaxed">
            To provide you with the best experience, we need access to your location. 
            This helps us show you relevant information and services in your area.
          </p>

          {locationStatus === 'denied' && (
            <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-xl p-4 mb-8">
              <p className="text-red-200">
                Location access was denied. Please enable location access in your browser settings to continue.
              </p>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={requestLocationAccess}
              className="w-full bg-white/20 hover:bg-white/30 text-white px-8 py-4 rounded-xl font-medium transition-all duration-300 backdrop-blur-sm border border-white/20 hover:border-white/30 shadow-lg hover:shadow-xl"
            >
              Allow Location Access
            </button>
            
            <button
              onClick={() => navigate('/')}
              className="w-full bg-black/20 hover:bg-black/30 text-white px-8 py-4 rounded-xl font-medium transition-all duration-300 backdrop-blur-sm border border-white/10 hover:border-white/20"
            >
              Continue Without Location
            </button>
          </div>

          <p className="text-white/60 text-sm mt-8">
            Your privacy is important to us. We only use your location to enhance your experience.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LocationAccess; 