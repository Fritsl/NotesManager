import React, { useState, useRef } from 'react';

export default function TestInputField() {
  const [textValue, setTextValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 p-3 z-50 border-t border-gray-700">
      <div className="text-sm text-white mb-2">Test Input Field (Outside Normal Flow)</div>
      <div className="flex flex-col gap-2">
        <input 
          ref={inputRef}
          type="text" 
          id="test-standalone-field"
          className="w-full p-2 rounded border border-gray-600 bg-gray-900 text-white" 
          placeholder="Type here to test focus behavior independently..."
          value={textValue}
          onChange={(e) => {
            console.log('Test field changed:', e.target.value);
            setIsTyping(true);
            setTextValue(e.target.value);
            
            // Clear typing state after a delay
            setTimeout(() => {
              setIsTyping(false);
            }, 100);
          }}
          onFocus={() => {
            console.log('Test field focused');
          }}
          onBlur={() => {
            console.log('Test field blurred');
            setIsTyping(false);
          }}
        />
        <div className="text-xs text-gray-400">
          Current value: {textValue} | Is typing: {isTyping ? 'Yes' : 'No'}
        </div>
      </div>
    </div>
  );
}