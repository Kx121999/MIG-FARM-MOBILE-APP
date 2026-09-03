import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import type { AvatarSelection } from '@/types/customer';

export async function selectAvatar(
  source: 'camera' | 'library',
): Promise<AvatarSelection | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('permission');
  } else if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('permission');
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
    base64: false,
    exif: false,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (
    !asset.width ||
    !asset.height ||
    (asset.fileSize && asset.fileSize > 25 * 1024 * 1024)
  )
    throw new Error('image_size');
  const context = ImageManipulator.manipulate(asset.uri);
  // Native picker offers a user-controlled crop; web keeps framing for preview.
  context.resize(
    asset.width >= asset.height
      ? { width: Math.min(512, asset.width) }
      : { height: Math.min(512, asset.height) },
  );
  const image = await context.renderAsync();
  const output = await image.saveAsync({
    compress: 0.85,
    format: SaveFormat.JPEG,
    base64: false,
  });
  return {
    uri: output.uri,
    width: output.width,
    height: output.height,
    mimeType: 'image/jpeg',
  };
}
