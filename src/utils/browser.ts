export async function openBrowser(url: string): Promise<void> {
  try {
    const open = (await import('open')).default;
    await open(url);
  } catch (error) {
    console.warn(`Failed to open browser automatically. Please visit: ${url}`);
  }
} 