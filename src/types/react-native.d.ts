import React from 'react';

export type StyleProp<T> = any;
export type ViewStyle = Record<string, any>;
export type TextStyle = Record<string, any>;
export type ImageStyle = Record<string, any>;

export interface ViewProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
  onStartShouldSetResponder?: (e: any) => boolean;
  onResponderGrant?: (e: any) => void;
  [key: string]: any;
}

export interface TextProps {
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  onPress?: () => void;
  children?: React.ReactNode;
  [key: string]: any;
}

export interface TouchableOpacityProps {
  style?: StyleProp<ViewStyle>;
  onPress?: (e?: any) => void;
  disabled?: boolean;
  activeOpacity?: number;
  children?: React.ReactNode;
  [key: string]: any;
}

export interface ImageProps {
  source: { uri: string } | number;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  [key: string]: any;
}

export interface ModalProps {
  visible?: boolean;
  transparent?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  onRequestClose?: () => void;
  children?: React.ReactNode;
}

export interface ScrollViewProps {
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  [key: string]: any;
}

export interface SwitchProps {
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  trackColor?: { false?: string; true?: string };
  thumbColor?: string;
}

export const View: React.ComponentType<ViewProps>;
export const SafeAreaView: React.ComponentType<ViewProps>;
export const Text: React.ComponentType<TextProps>;
export const TouchableOpacity: React.ComponentType<TouchableOpacityProps>;
export const Pressable: React.ComponentType<TouchableOpacityProps>;
export const Image: React.ComponentType<ImageProps>;
export const Modal: React.ComponentType<ModalProps>;
export const ScrollView: React.ComponentType<ScrollViewProps>;
export const Switch: React.ComponentType<SwitchProps>;

export const StyleSheet: {
  create<T extends Record<string, any>>(styles: T): T;
  flatten(style?: any): any;
  absoluteFillObject: Record<string, any>;
};

export const Platform: {
  OS: 'web' | 'ios' | 'android';
  select<T>(specifics: { [platform: string]: T }): T;
};

export const Linking: {
  openURL(url: string): Promise<void>;
};

export const Share: {
  share(content: { title?: string; message?: string; url?: string }): Promise<any>;
};

export const Dimensions: {
  get(dim: 'window' | 'screen'): { width: number; height: number };
};

export const AppRegistry: {
  registerComponent(appKey: string, componentProvider: () => React.ComponentType<any>): string;
  runApplication(appKey: string, appParameters: Record<string, any>): void;
};
