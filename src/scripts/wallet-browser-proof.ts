const parameters = new URLSearchParams(window.location.search);

if (parameters.get('wallet-proof') === '1') {
  const device = document.querySelector<HTMLElement>('ee-hardware-wallet[data-reference-device]');
  const lab = device?.closest<HTMLElement>('[data-device-lab]');

  if (device && lab) {
    const waitForTitle = async (title: string, timeout = 12_000): Promise<void> => {
      const started = performance.now();
      while (device.getAttribute('screen-title') !== title) {
        if (performance.now() - started > timeout) {
          throw new Error(`Wallet browser proof timed out waiting for ${title}`);
        }
        await new Promise<void>((resolve) => window.setTimeout(resolve, 25));
      }
    };

    const click = (part: 'button-left' | 'button-right'): void => {
      const target = device.shadowRoot?.querySelector<SVGGElement>(`[data-part="${part}"]`);
      if (!target) throw new Error(`Wallet browser proof cannot find ${part}`);
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    };

    void (async () => {
      try {
        lab.dataset.walletProof = 'running';
        await waitForTitle('WALLET LOCKED');
        click('button-right');
        await waitForTitle('DEVICE READY');
        click('button-right');
        await waitForTitle('REVIEW TRANSACTION');
        click('button-right');
        await waitForTitle('APPROVED');
        lab.dataset.walletSawSigning = 'true';
        await waitForTitle('SIGNATURE READY');
        lab.dataset.walletProof = 'complete';
      } catch (error) {
        lab.dataset.walletProof = 'failed';
        lab.dataset.walletProofError = error instanceof Error ? error.message : String(error);
      }
    })();
  }
}
