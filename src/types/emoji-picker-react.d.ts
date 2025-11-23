declare module 'emoji-picker-react' {
  import * as React from 'react';

  export interface EmojiClickData {
    activeSkinTone: string;
    unified: string;
    unifiedWithoutSkinTone: string;
    emoji: string;
    names: string[];
    getImageUrl: (emojiStyle: string) => string;
  }

  export interface EmojiPickerProps {
    onEmojiClick?: (emojiData: EmojiClickData, event: MouseEvent) => void;
    autoFocusSearch?: boolean;
    theme?: 'light' | 'dark' | 'auto';
    emojiStyle?: 'native' | 'apple' | 'google' | 'facebook' | 'twitter';
    defaultSkinTone?: string;
    lazyLoadEmojis?: boolean;
    previewConfig?: {
      defaultEmoji?: string;
      defaultCaption?: string;
      showPreview?: boolean;
    };
    searchDisabled?: boolean;
    skinTonesDisabled?: boolean;
    width?: number | string;
    height?: number | string;
    style?: React.CSSProperties;
    className?: string;
  }

  export default function EmojiPicker(props: EmojiPickerProps): JSX.Element;
  
  export enum Theme {
    DARK = "dark",
    LIGHT = "light",
    AUTO = "auto",
  }
  
  export enum EmojiStyle {
    NATIVE = "native",
    APPLE = "apple",
    TWITTER = "twitter",
    GOOGLE = "google",
    FACEBOOK = "facebook",
  }
}
