import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform, ScrollView, Linking } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { OPENAI_API_KEY } from '@env';

type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'uk' | 'ar' | 'zh' | 'cs' | 'pl';

const languages: Array<{ code: LanguageCode; name: string }> = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'pl', name: 'Polish' },
  { code: 'ru', name: 'Russian' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'zh', name: 'Chinese (Simplified)' },
  { code: 'cs', name: 'Czech' },
];

const openAIVoices = [
  { name: 'Alloy', id: 'alloy' },
  { name: 'Echo', id: 'echo' },
  { name: 'Fable', id: 'fable' },
  { name: 'Onyx', id: 'onyx' },
  { name: 'Nova', id: 'nova' },
  { name: 'Shimmer', id: 'shimmer' },
];

interface TranslationComponentProps {
  onShowSubscription: () => void;
  onSignOut: () => void;
}

export const TranslationComponent: React.FC<TranslationComponentProps> = ({
  onShowSubscription,
  onSignOut,
}) => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode>('en');
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>('es');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [audioLevel, setAudioLevel] = useState(-160);
  const [selectedVoice, setSelectedVoice] = useState('alloy');
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [lastSourceLanguage, setLastSourceLanguage] = useState<LanguageCode>('en');
  const [lastTargetLanguage, setLastTargetLanguage] = useState<LanguageCode>('es');

  useEffect(() => {
    const getPermission = async () => {
      try {
        setStatus('Requesting audio permission...');
        const permission = await Audio.requestPermissionsAsync();
        
        if (!permission.granted) {
          setError('Please grant microphone permission to use the recorder.');
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        setStatus('Ready to record');
      } catch (err) {
        console.error('Error getting permission:', err);
        setError('Failed to get recording permission');
      }
    };

    getPermission();
  }, []);

  const switchLanguagesAndRecord = async () => {
    // Switch languages
    const tempSource = sourceLanguage;
    const tempTarget = targetLanguage;
    setSourceLanguage(tempTarget);
    setTargetLanguage(tempSource);
    
    // Start recording
    await startRecording();
  };

  const handleLanguageChange = (source: LanguageCode, target: LanguageCode) => {
    setLastSourceLanguage(source);
    setLastTargetLanguage(target);
    setSourceLanguage(source);
    setTargetLanguage(target);
  };

  const startRecording = async () => {
    try {
      setError('');
      setStatus('Starting recording...');

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission is required.');
        return;
      }

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status: Audio.RecordingStatus) => {
          if (status.isRecording) {
            setAudioLevel(status.metering || -160);
          }
        },
        100
      );

      setRecording(newRecording);
      setIsRecording(true);
      setStatus('Recording in progress...');

    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording. Please try again.');
      setStatus('Recording failed');
      setIsRecording(false);
      setRecording(null);
    }
  };

  const stopRecording = async () => {
    try {
      setStatus('Stopping recording...');

      if (!recording) {
        setError('No active recording found.');
        return;
      }

      await recording.stopAndUnloadAsync().catch(() => {
        // Ignore unload errors
      });
      setIsRecording(false);

      const uri = recording.getURI();
      if (!uri) {
        throw new Error('No recording URI available');
      }

      setStatus('Processing audio...');

      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'audio/m4a',
        name: 'audio.m4a'
      } as any);
      formData.append('model', 'whisper-1');
      formData.append('language', sourceLanguage);

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      setSourceText(data.text);

      const detectionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are a language detector. Analyze the following text and determine if it's in ${languages.find(l => l.code === targetLanguage)?.name} language. Respond with only "yes" or "no".`
            },
            {
              role: 'user',
              content: data.text
            }
          ],
          temperature: 0.3,
          max_tokens: 10
        })
      });

      if (!detectionResponse.ok) {
        throw new Error('Language detection failed');
      }

      const detectionData = await detectionResponse.json();
      const isTargetLanguage = detectionData.choices[0].message.content.toLowerCase().includes('yes');

      if (isTargetLanguage) {
        setSourceLanguage(targetLanguage);
        setTargetLanguage(sourceLanguage);
      }

      await translateText(data.text);

      setRecording(null);
      setStatus('Translation complete');
      setAudioLevel(-160);

    } catch (err) {
      console.error('Failed to process recording:', err);
      setError('Failed to process recording. Please try again.');
      setStatus('Processing failed');
    } finally {
      setIsRecording(false);
      setRecording(null);
    }
  };

  const translateText = async (text: string) => {
    try {
      setStatus('Translating...');

      const sourceLang = languages.find(l => l.code === sourceLanguage)?.name || sourceLanguage;
      const targetLang = languages.find(l => l.code === targetLanguage)?.name || targetLanguage;
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}. Provide only the translation without any additional comments or explanations.`
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();
      const translatedText = data.choices[0].message.content.trim();
      setTranslatedText(translatedText);
      setStatus('Translation complete');
      
      await speakTranslation(translatedText);

    } catch (err) {
      console.error('Translation error:', err);
      setError('Failed to translate text');
      setStatus('Translation failed');
    }
  };

  const speakTranslation = async (textToSpeak?: string) => {
    try {
      const textToRead = textToSpeak || translatedText;
      if (!textToRead) return;
      
      setStatus('Generating speech...');

      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: selectedVoice,
          input: textToRead,
        }),
      });

      if (!response.ok) {
        throw new Error('Speech synthesis failed');
      }

      const audioBlob = await response.blob();
      const audioUri = FileSystem.documentDirectory + 'speech.mp3';

      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      await new Promise((resolve, reject) => {
        reader.onloadend = async () => {
          try {
            if (typeof reader.result === 'string') {
              const base64Data = reader.result.split(',')[1];
              await FileSystem.writeAsStringAsync(audioUri, base64Data, {
                encoding: FileSystem.EncodingType.Base64,
              });
              resolve(undefined);
            } else {
              reject(new Error('Failed to read audio data'));
            }
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );
      setSound(newSound);
      setStatus('Playing speech...');

      newSound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.isLoaded && status.didJustFinish) {
          await newSound.unloadAsync();
          setSound(null);
          setStatus('Playback complete');
        }
      });
    } catch (err) {
      console.error('Speech error:', err);
      setError('Failed to generate or play speech');
      setStatus('Speech generation failed');
    }
  };

  const getAudioLevelWidth = () => {
    const minDb = -160;
    const maxDb = 0;
    const percentage = ((audioLevel - minDb) / (maxDb - minDb)) * 100;
    return Math.max(0, Math.min(100, percentage));
  };

  const renderLanguagePicker = (
    value: LanguageCode,
    onValueChange: (value: LanguageCode) => void,
    label: string
  ) => (
    <View style={styles.pickerContainer}>
      <Text style={styles.label}>{label}</Text>
      <Picker<LanguageCode>
        selectedValue={value}
        style={styles.picker}
        onValueChange={onValueChange}>
        {languages.map(lang => (
          <Picker.Item
            key={lang.code}
            label={lang.name}
            value={lang.code}
          />
        ))}
      </Picker>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={onShowSubscription}
        >
          <Text style={styles.headerButtonText}>Subscription</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={onSignOut}
        >
          <Text style={styles.headerButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.languageSelectors}>
        {renderLanguagePicker(
          sourceLanguage,
          (value) => handleLanguageChange(value, targetLanguage),
          'From:'
        )}
        {renderLanguagePicker(
          targetLanguage,
          (value) => handleLanguageChange(sourceLanguage, value),
          'To:'
        )}
      </View>

      <View style={styles.voiceSelector}>
        <Text style={styles.label}>Voice:</Text>
        <Picker
          selectedValue={selectedVoice}
          style={styles.picker}
          onValueChange={setSelectedVoice}>
          {openAIVoices.map(voice => (
            <Picker.Item
              key={voice.id}
              label={voice.name}
              value={voice.id}
            />
          ))}
        </Picker>
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.textLabel}>Original Text:</Text>
        <ScrollView style={styles.scrollContainer}>
          <Text style={styles.text}>{sourceText}</Text>
        </ScrollView>
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.textLabel}>Translated Text:</Text>
        <ScrollView style={styles.scrollContainer}>
          <Text style={styles.text}>{translatedText}</Text>
        </ScrollView>
      </View>

      <View style={styles.audioLevelContainer}>
        <View style={[styles.audioLevelBar, { width: `${getAudioLevelWidth()}%` }]} />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, styles.buttonBlue, isRecording && styles.buttonActive]}
          onPress={isRecording ? stopRecording : startRecording}>
          <Text style={styles.buttonText}>
            {isRecording ? 'Stop' : 'Start'} Recording
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonOrange, { marginLeft: 10 }]}
          onPress={switchLanguagesAndRecord}
          disabled={isRecording}>
          <Text style={styles.buttonText}>
            Switch Languages/Listen
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, styles.buttonGreen]}
          onPress={() => speakTranslation()}
          disabled={!translatedText}>
          <Text style={styles.buttonText}>Speak Translation</Text>
        </TouchableOpacity>
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      
      <Text style={styles.demoNote}>
        Using OpenAI for Speech Recognition & Text-to-Speech
      </Text>

      <TouchableOpacity 
        style={styles.developerLink}
        onPress={() => Linking.openURL('http://www.arnika-web.com')}>
        <Text style={styles.linkText}>www.arnika-web.com</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  languageSelectors: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  pickerContainer: {
    flex: 1,
    marginHorizontal: 5,
  },
  voiceSelector: {
    marginBottom: 20,
  },
  picker: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333333',
  },
  textContainer: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    height: 120,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  scrollContainer: {
    flex: 1,
  },
  textLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333333',
  },
  text: {
    fontSize: 16,
    color: '#666666',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  button: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  buttonBlue: {
    backgroundColor: '#007AFF',
  },
  buttonOrange: {
    backgroundColor: '#FF9500',
  },
  buttonGreen: {
    backgroundColor: '#34C759',
  },
  buttonActive: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  error: {
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
  },
  status: {
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
  },
  demoNote: {
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 12,
    fontStyle: 'italic',
  },
  audioLevelContainer: {
    height: 4,
    backgroundColor: '#E5E5E5',
    borderRadius: 2,
    marginBottom: 20,
    overflow: 'hidden',
  },
  audioLevelBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  developerLink: {
    marginTop: 'auto',
    paddingVertical: 10,
  },
  linkText: {
    color: '#007AFF',
    textAlign: 'center',
    textDecorationLine: 'underline',
    fontSize: 12,
  },
});
