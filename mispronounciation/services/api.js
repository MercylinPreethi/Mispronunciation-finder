import axios from 'axios';

// Change this to your Flask server's IP address
const API_BASE_URL = 'http://192.168.14.34:5050'; 

export const analyzePronunciation = async (audioData, referenceText) => {
  try {
    const formData = new FormData();
    
    // Extract base64 data from data URI
    const base64Data = audioData.split(',')[1];
    
    formData.append('audio', {
      uri: audioData,
      type: 'audio/m4a',
      name: 'recording.m4a',
    });

    formData.append('reference_text', referenceText);

    const response = await axios.post(`${API_BASE_URL}/analyze`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000,
    });

    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    throw new Error(error.response?.data?.error || 'Network error');
  }
};

export const healthCheck = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    return response.data;
  } catch (error) {
    throw new Error('Server is not available');
  }
};