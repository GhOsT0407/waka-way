import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { decode } from 'base64-arraybuffer';

// Storage bucket name
const BUCKET_NAME = 'report-images';

// Allowed image types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Max file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export interface ImageUploadResult {
  success: boolean;
  publicUrl?: string;
  error?: string;
  filePath?: string;
}

export interface ImagePickerResult {
  success: boolean;
  uri?: string;
  base64?: string;
  mimeType?: string;
  error?: string;
}

/**
 * Request camera permissions
 */
export async function requestCameraPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * Request media library permissions
 */
export async function requestMediaLibraryPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * Pick an image from the device's photo library
 * Returns the image URI and base64 data for upload
 */
export async function pickImageFromLibrary(): Promise<ImagePickerResult> {
  try {
    // Request permissions first
    const hasPermission = await requestMediaLibraryPermissions();
    if (!hasPermission) {
      return {
        success: false,
        error: 'Permission to access media library was denied',
      };
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8, // Compress to 80% quality
      base64: true, // Get base64 for upload
    });

    if (result.canceled) {
      return {
        success: false,
        error: 'Image selection was cancelled',
      };
    }

    const asset = result.assets[0];

    // Check file size if available
    if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
      return {
        success: false,
        error: 'Image is too large. Please select an image under 5MB.',
      };
    }

    return {
      success: true,
      uri: asset.uri,
      base64: asset.base64 || undefined,
      mimeType: asset.mimeType || 'image/jpeg',
    };
  } catch (error) {
    console.error('Error picking image:', error);
    return {
      success: false,
      error: 'Failed to pick image from library',
    };
  }
}

/**
 * Take a photo using the device camera
 * In Lagos, a photo of a "Road Block" is better than a text report!
 */
export async function takePhoto(): Promise<ImagePickerResult> {
  try {
    // Request camera permissions
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) {
      return {
        success: false,
        error: 'Permission to access camera was denied',
      };
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) {
      return {
        success: false,
        error: 'Photo capture was cancelled',
      };
    }

    const asset = result.assets[0];

    return {
      success: true,
      uri: asset.uri,
      base64: asset.base64 || undefined,
      mimeType: asset.mimeType || 'image/jpeg',
    };
  } catch (error) {
    console.error('Error taking photo:', error);
    return {
      success: false,
      error: 'Failed to take photo',
    };
  }
}

/**
 * Upload an image to Supabase Storage using ArrayBuffer
 * This approach works better in React Native than Blob/File
 * 
 * @param base64Data - Base64 encoded image data (without data:image/... prefix)
 * @param mimeType - MIME type of the image (e.g., 'image/jpeg')
 * @param fileName - Optional custom filename
 * @returns Upload result with public URL
 */
export async function uploadImageToSupabase(
  base64Data: string,
  mimeType: string = 'image/jpeg',
  fileName?: string
): Promise<ImageUploadResult> {
  try {
    // Validate mime type
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return {
        success: false,
        error: `Invalid image type. Allowed types: ${ALLOWED_TYPES.join(', ')}`,
      };
    }

    // Get current user for folder organization
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'anonymous';

    // Generate unique filename
    const timestamp = Date.now();
    const extension = mimeType.split('/')[1] || 'jpg';
    const uniqueFileName = fileName || `report_${timestamp}.${extension}`;
    
    // Organize by user ID for easier management
    const filePath = `${userId}/${uniqueFileName}`;

    // Convert base64 to ArrayBuffer using base64-arraybuffer library
    // This is the recommended approach for React Native
    const arrayBuffer = decode(base64Data);

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, arrayBuffer, {
        contentType: mimeType,
        upsert: false, // Don't overwrite existing files
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return {
        success: false,
        error: uploadError.message || 'Failed to upload image',
      };
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      return {
        success: false,
        error: 'Failed to get public URL for uploaded image',
      };
    }

    return {
      success: true,
      publicUrl: urlData.publicUrl,
      filePath: data?.path || filePath,
    };
  } catch (error) {
    console.error('Error uploading image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload image',
    };
  }
}

/**
 * Pick and upload an image in one step
 * Convenience function for the complete flow
 */
export async function pickAndUploadImage(): Promise<ImageUploadResult> {
  // Pick image from library
  const pickResult = await pickImageFromLibrary();
  
  if (!pickResult.success || !pickResult.base64) {
    return {
      success: false,
      error: pickResult.error || 'Failed to get image data',
    };
  }

  // Upload to Supabase
  return uploadImageToSupabase(pickResult.base64, pickResult.mimeType);
}

/**
 * Take photo and upload in one step
 * Convenience function for the complete flow
 */
export async function takePhotoAndUpload(): Promise<ImageUploadResult> {
  // Take photo
  const photoResult = await takePhoto();
  
  if (!photoResult.success || !photoResult.base64) {
    return {
      success: false,
      error: photoResult.error || 'Failed to capture photo',
    };
  }

  // Upload to Supabase
  return uploadImageToSupabase(photoResult.base64, photoResult.mimeType);
}

/**
 * Delete an image from Supabase Storage
 */
export async function deleteImage(filePath: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting image:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
}

/**
 * Get a signed URL for private images (if bucket is private)
 */
export async function getSignedUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }

    return data?.signedUrl || null;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    return null;
  }
}

export default {
  pickImageFromLibrary,
  takePhoto,
  uploadImageToSupabase,
  pickAndUploadImage,
  takePhotoAndUpload,
  deleteImage,
  getSignedUrl,
  requestCameraPermissions,
  requestMediaLibraryPermissions,
};
