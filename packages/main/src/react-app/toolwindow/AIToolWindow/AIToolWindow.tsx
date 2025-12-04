import React, { useEffect, useRef, useState } from 'react';
import { ToolWindow } from '../ToolWindow';
import { Button } from '@diagram-craft/app-components/Button';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { useDiagram } from '../../../application';
import { AIMessage, aiService } from '../../ai/aiService';
import { AIModel } from '../../ai/aiModel';
import { SimplifiedDiagram } from '../../ai/aiDiagramTypes';
import { createSystemMessage } from '../../ai/aiSystemPrompt';
import styles from './AIToolWindow.module.css';
import { isEmptyString } from '@diagram-craft/utils/strings';
import { extractJSON, filterJsonFromContent } from '../../ai/aiContentParser';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';

interface ConversationMessage extends AIMessage {
  timestamp: number;
}

const isValidDiagramSpec = (diagramSpec: SimplifiedDiagram) =>
  diagramSpec.action && (diagramSpec.nodes || diagramSpec.edges || diagramSpec.modifications);

export const AIToolWindow = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [textAreaKey, setTextAreaKey] = useState(0);

  const activeLayer = diagram.activeLayer;
  const isDisabled = activeLayer.type !== 'regular' || activeLayer.isLocked() || loading;

  useEventListener(diagram.layers, 'layerStructureChange', redraw);

  // biome-ignore lint/correctness/useExhaustiveDependencies: we need this to trigger when the stream changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [messages, streamingContent]);

  const sendMessage = async () => {
    if (isEmptyString(input) || loading) return;

    const userMessage: ConversationMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setTextAreaKey(prev => prev + 1); // Force TextArea to remount with empty value

    setLoading(true);
    setError(undefined);
    setStreamingContent('');

    let accumulatedContent = '';

    try {
      // Get current diagram context
      const aiModel = new AIModel(diagram);
      const currentDiagram = aiModel.asAIView();

      // Build conversation history
      const conversationMessages: AIMessage[] = [
        {
          role: 'system',
          content: createSystemMessage(currentDiagram)
        },
        ...messages,
        userMessage
      ];

      // Call AI service with streaming
      await aiService.generate(
        {
          messages: conversationMessages,
          stream: true
        },
        chunk => {
          if (!chunk.done) {
            accumulatedContent += chunk.content;
            setStreamingContent(accumulatedContent);
          }
        }
      );

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: accumulatedContent,
          timestamp: Date.now()
        }
      ]);
      setStreamingContent('');

      // Try to extract and apply diagram JSON
      await applyDiagramFromResponse(accumulatedContent);
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);

      // Add error message to conversation
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${errorMessage}`,
          timestamp: Date.now()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const applyDiagramFromResponse = async (content: string) => {
    const json = extractJSON(content);
    if (!json) return;

    const diagramSpec = json as SimplifiedDiagram;

    // Validate it's a diagram specification
    if (isValidDiagramSpec(diagramSpec)) {
      const aiModel = new AIModel(diagram);

      try {
        aiModel.applyChange(diagramSpec);
      } catch (e) {
        setError(`Failed to apply diagram: ${(e as Error).message}`);
      }
    }
  };

  const clear = () => {
    setMessages([]);
    setError(undefined);
    setStreamingContent('');
    setInput('');

    // Force TextArea to remount with empty value
    setTextAreaKey(prev => prev + 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <ToolWindow.Root id={'ai-tool'} defaultTab={'chat'}>
      <ToolWindow.Tab id={'chat'} title={'Chat'}>
        <ToolWindow.TabContent>
          <div className={styles['cmp-ai-container']}>
            <div className={styles['cmp-ai-messages']}>
              {messages.length === 0 && (
                <div className={styles['cmp-ai-welcome']}>
                  <h3>AI Diagram Assistant</h3>
                  <p>Ask me to create or modify diagrams!</p>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} className={`${styles['cmp-ai-message']} ${styles[msg.role]}`}>
                  <div className={styles['cmp-ai-message-role']}>
                    {msg.role === 'user' ? 'You' : 'AI'}
                  </div>
                  <div className={styles['cmp-ai-message-content']}>
                    {msg.role === 'assistant' ? filterJsonFromContent(msg.content) : msg.content}
                  </div>
                </div>
              ))}

              {streamingContent && (
                <div className={`${styles['cmp-ai-message']} ${styles.assistant}`}>
                  <div className={styles['cmp-ai-message-role']}>AI</div>
                  <div className={styles['cmp-ai-message-content']}>
                    {filterJsonFromContent(streamingContent)}
                    <span className={styles['cmp-ai-cursor']}>|</span>
                  </div>
                </div>
              )}

              {error && (
                <div className={styles['cmp-ai-error']}>
                  <strong>Error:</strong> {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className={styles['cmp-ai-input-area']}>
              <TextArea
                key={textAreaKey}
                value={input}
                onChange={value => setInput(value ?? '')}
                onKeyDown={handleKeyDown}
                placeholder="Describe the diagram you want to create..."
                rows={3}
                disabled={isDisabled}
                className={styles['cmp-ai-input']}
              />
              <div className={styles['cmp-ai-actions']}>
                <Button onClick={clear} disabled={isDisabled} type="secondary">
                  Clear
                </Button>
                <Button onClick={sendMessage} disabled={isDisabled || !input.trim()}>
                  {loading ? 'Generating...' : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
