import { ethers, providers } from 'ethers'
import { Environment, CurrentConfig } from '../config'
import { BaseProvider } from '@ethersproject/providers'

// Single copies of provider and wallet
const mainnetProvider = new ethers.providers.JsonRpcProvider(
  CurrentConfig.rpc.mainnet
)
const localProvider = new ethers.providers.JsonRpcProvider(
  CurrentConfig.rpc.local
)
const wallet = createWallet()

const browserExtensionProvider = createBrowserExtensionProvider()
let walletExtensionAddress: string | null = null

// Interfaces

export enum TransactionState {
  Failed = 'Failed',
  New = 'New',
  Rejected = 'Rejected',
  Sending = 'Sending',
  Sent = 'Sent',
}

// Provider and Wallet Functions

export function getMainnetProvider(): BaseProvider {
  return mainnetProvider
}

export function getProvider():
  | providers.JsonRpcProvider
  | providers.Web3Provider
  | null {
  if (CurrentConfig.env === Environment.WALLET_EXTENSION) {
    return browserExtensionProvider
  } else if (CurrentConfig.env === Environment.PRODUCTION) {
    return mainnetProvider
  } else {
    return localProvider
  }
}

export function getWallet(): ethers.providers.JsonRpcSigner {
  const provider = getProvider()
  if (provider === null) {
    throw new Error('Cannot get wallet without connected provider')
  }
  return provider.getSigner()
}

export function getWalletAddress(): string | null {
  return CurrentConfig.env === Environment.WALLET_EXTENSION
    ? walletExtensionAddress
    : wallet.address
}

export async function connectBrowserExtensionWallet() {
  if (!window.ethereum) {
    return null
  }

  const { ethereum } = window
  const provider = new ethers.providers.Web3Provider(ethereum)
  const accounts = await provider.send('eth_requestAccounts', [])

  if (accounts.length !== 1) {
    return
  }

  walletExtensionAddress = accounts[0]
  return walletExtensionAddress
}

// Internal Functionality

function createWallet(): ethers.Wallet {
  let provider = mainnetProvider
  if (CurrentConfig.env == Environment.LOCAL) {
    provider = new ethers.providers.JsonRpcProvider(CurrentConfig.rpc.local)
  }
  return new ethers.Wallet(CurrentConfig.wallet.privateKey, provider)
}

function createBrowserExtensionProvider(): ethers.providers.Web3Provider | null {
  try {
    return new ethers.providers.Web3Provider(window?.ethereum, 'any')
  } catch (e) {
    console.log('No Wallet Extension Found')
    return null
  }
}

export async function waitForReceipt(
  txRes: ethers.providers.TransactionResponse
): Promise<TransactionState> {
  let receipt = null
  const provider = getProvider()
  if (!provider) {
    return TransactionState.Failed
  }

  while (receipt === null) {
    try {
      receipt = await provider.getTransactionReceipt(txRes.hash)

      if (receipt === null) {
        continue
      }
    } catch (e) {
      console.log(`Receipt error:`, e)
      break
    }
  }

  // Transaction was successful if status === 1
  if (receipt) {
    return TransactionState.Sent
  } else {
    return TransactionState.Failed
  }
}
