import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { avatarColorFor } from '../utils/avatarColor';
import { contactInitials } from '../utils/photoApi';

interface Props {
  firstName?: string | null;
  surname?: string | null;
  size?: number;
  /** Signed URL; when it fails to load the initials stay. */
  photoUrl?: string | null;
}

/** Contact photo when there is one, colored initials otherwise. */
export default function ContactAvatar({ firstName, surname, size = 44, photoUrl }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = !!photoUrl && failedUrl !== photoUrl;
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColorFor(firstName, surname) }]}>
      {showPhoto ? (
        <Image
          source={{ uri: photoUrl! }}
          style={{ width: size, height: size }}
          contentFit="cover"
          onError={() => setFailedUrl(photoUrl!)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={{ color: '#fff', fontSize: Math.round(size * 0.38), fontWeight: '600', letterSpacing: 0.5 }}>
          {contactInitials(firstName ?? '', surname ?? '')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
