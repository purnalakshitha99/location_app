import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getDeviceLocation = () => {
    return new Promise((resolve, reject) => {
      console.log('Requesting device location...');
      if (!navigator.geolocation) {
        console.error('Geolocation is not supported by this browser');
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Device location received:', position);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.error('Error getting device location:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    });
  };

  const getVisitorData = async () => {
    console.log('Starting to fetch visitor data...');
    try {
      // Get user's IP address
      console.log('Fetching IP address from ipify.org...');
      const ipResponse = await fetch('https://api.ipify.org?format=json', {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!ipResponse.ok) {
        console.error('IP API error:', ipResponse.status, ipResponse.statusText);
        throw new Error(`IP API error: ${ipResponse.status}`);
      }
      
      const ipData = await ipResponse.json();
      const ip = ipData.ip;
      console.log('IP address fetched successfully:', ip);

      // Get device location
      console.log('Requesting device location...');
      let deviceLocation;
      try {
        deviceLocation = await getDeviceLocation();
        console.log('Device location received:', deviceLocation);
      } catch (locationError) {
        console.error('Error getting device location:', locationError);
        deviceLocation = { latitude: null, longitude: null, accuracy: null };
      }

      // Get location data from IP using ipinfo.io for additional information
      console.log('Fetching additional location data from ipinfo.io...');
      const locationResponse = await fetch(`https://ipinfo.io/${ip}/json?token=${import.meta.env.VITE_IPINFO_TOKEN}`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!locationResponse.ok) {
        console.error('Location API error:', locationResponse.status, locationResponse.statusText);
        throw new Error(`Location API error: ${locationResponse.status}`);
      }
      
      const locationData = await locationResponse.json();
      console.log('Location data received:', locationData);

      // Get device details
      console.log('Collecting device details...');
      const deviceDetails = {
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        platform: navigator.platform,
        vendor: navigator.vendor,
        cookiesEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        online: navigator.onLine,
      };
      console.log('Device details collected:', deviceDetails);

      const visitorData = {
        ip,
        location: {
          latitude: deviceLocation.latitude,
          longitude: deviceLocation.longitude,
          accuracy: deviceLocation.accuracy,
          city: locationData.city || 'Unknown',
          region: locationData.region || 'Unknown',
          country: locationData.country || 'Unknown',
          postal: locationData.postal || 'Unknown',
          timezone: locationData.timezone || 'Unknown'
        },
        deviceDetails,
        timestamp: new Date().toISOString()
      };

      console.log('Complete visitor data prepared:', visitorData);
      return visitorData;
    } catch (error) {
      console.error('Error in getVisitorData:', error);
      console.error('Error stack:', error.stack);
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Form submission started...');
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      // Get visitor data
      console.log('Fetching visitor data...');
      const visitorData = await getVisitorData();
      console.log('Visitor data received:', visitorData);

      // Prepare the complete data to save
      const contactData = {
        ...formData,
        visitorData,
        submittedAt: new Date().toISOString()
      };
      console.log('Complete contact data prepared:', contactData);

      // Save to Firebase with retry logic
      let retryCount = 0;
      const maxRetries = 3;
      let lastError = null;

      while (retryCount < maxRetries) {
        try {
          console.log(`Attempting to save to Firebase (attempt ${retryCount + 1}/${maxRetries})...`);
          console.log('Firebase config:', {
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
          });
          
          const contactsCollection = collection(db, 'contacts');
          console.log('Collection reference created');
          
          const docRef = await addDoc(contactsCollection, contactData);
          console.log('Document written with ID:', docRef.id);
          
          setSubmitStatus('success');
          setFormData({ name: '', email: '', message: '' });
          break;
        } catch (error) {
          lastError = error;
          retryCount++;
          console.error(`Firebase error (attempt ${retryCount}/${maxRetries}):`, error);
          console.error('Error details:', {
            code: error.code,
            message: error.message,
            stack: error.stack,
            name: error.name
          });
          
          // Check for specific Firebase error codes
          if (error.code === 'permission-denied') {
            console.error('Firebase permission denied. Please check your security rules.');
            throw new Error('Permission denied. Please check your Firebase security rules.');
          } else if (error.code === 'unauthenticated') {
            console.error('Firebase authentication required.');
            throw new Error('Authentication required. Please check your Firebase configuration.');
          }
          
          if (retryCount === maxRetries) {
            throw lastError;
          }
          
          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
      console.log('Form submission process completed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          required
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {isSubmitting ? 'Sending...' : 'Send Message'}
      </button>

      {submitStatus === 'success' && (
        <p className="text-green-600 text-sm">Message sent successfully!</p>
      )}
      {submitStatus === 'error' && (
        <p className="text-red-600 text-sm">Failed to send message. Please try again.</p>
      )}
    </form>
  );
};

export default ContactForm; 