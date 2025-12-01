import { useState, useRef, useEffect } from 'react';
import { ToolWindow } from '../ToolWindow';
import { Button } from '@diagram-craft/app-components/Button';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { useDiagram } from '../../../application';
import { aiService, AIMessage } from '../../ai/aiService';
import { DiagramConverter } from '../../ai/diagramConverter';
import { SimplifiedDiagram } from '../../ai/aiDiagramTypes';
import { createSystemMessage } from '../../ai/aiSystemPrompt';
import styles from './AIToolWindow.module.css';
import { mustExist } from '@diagram-craft/utils/assert';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export const AIToolWindow = () => {
  const diagram = useDiagram();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isAvailable, setIsAvailable] = useState<boolean | undefined>();
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check AI availability on mount
  useEffect(() => {
    aiService.checkAvailability().then(setIsAvailable);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ConversationMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(undefined);
    setStreamingContent('');

    let accumulatedContent = '';

    try {
      // Get current diagram context
      const converter = new DiagramConverter(diagram);
      const currentDiagram = converter.exportToSimplified();

      // Build conversation history
      const conversationMessages: AIMessage[] = [
        {
          role: 'system',
          content: createSystemMessage(currentDiagram)
        },
        ...messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        })),
        {
          role: 'user',
          content: userMessage.content
        }
      ];

      // Call AI service with streaming
      await aiService.generate(
        {
          messages: conversationMessages,
          stream: true,
          temperature: 0.7
        },
        chunk => {
          if (!chunk.done) {
            accumulatedContent += chunk.content;
            setStreamingContent(accumulatedContent);
          }
        }
      );

      // Extract and apply diagram changes
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: accumulatedContent,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);
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
    // Try to extract JSON from markdown code blocks
    const jsonMatch =
      content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);

    let jsonStr: string = mustExist(jsonMatch ? jsonMatch[1] : content);

    // Try to find JSON object in the response
    const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      jsonStr = jsonObjectMatch[0];
    }

    try {
      const diagramSpec: SimplifiedDiagram = JSON.parse(jsonStr);

      // Validate it's a diagram specification
      if (
        diagramSpec.action &&
        (diagramSpec.nodes || diagramSpec.edges || diagramSpec.modifications)
      ) {
        const converter = new DiagramConverter(diagram);

        // Log for debugging
        console.log('Applying diagram spec:', diagramSpec);

        try {
          converter.convert(diagramSpec);
          console.log('Diagram updated successfully');
        } catch (conversionError) {
          console.error('Error converting diagram:', conversionError);
          setError(`Failed to apply diagram: ${(conversionError as Error).message}`);
        }
      }
    } catch (parseError) {
      // Not a valid diagram JSON, that's okay - might be a conversational response
      console.log('No valid diagram JSON found in response');
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError(undefined);
    setStreamingContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isAvailable === false) {
    return (
      <div className={styles['cmp-ai-unavailable']}>
        <p>AI features are not available.</p>
        <p className={styles['cmp-ai-hint']}>
          The server needs an OpenRouter API key to enable AI features.
        </p>
      </div>
    );
  }

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
                  <div className={styles['cmp-ai-message-content']}>{msg.content}</div>
                </div>
              ))}

              {streamingContent && (
                <div className={`${styles['cmp-ai-message']} ${styles.assistant}`}>
                  <div className={styles['cmp-ai-message-role']}>AI</div>
                  <div className={styles['cmp-ai-message-content']}>
                    {streamingContent}
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
                value={input}
                onChange={value => setInput(value ?? '')}
                onKeyDown={handleKeyDown}
                placeholder="Describe the diagram you want to create..."
                rows={3}
                disabled={loading}
                className={styles['cmp-ai-input']}
              />
              <div className={styles['cmp-ai-actions']}>
                <Button onClick={handleClear} disabled={loading} type="secondary">
                  Clear
                </Button>
                <Button onClick={handleSend} disabled={loading || !input.trim()}>
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
