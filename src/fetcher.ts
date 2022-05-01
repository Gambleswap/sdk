import { Pool } from './../entities/lendingPool';
import { Contract } from '@ethersproject/contracts'
import { getNetwork } from '@ethersproject/networks'
import { BaseProvider, getDefaultProvider, Provider } from '@ethersproject/providers'
import { TokenAmount } from './entities/fractions/tokenAmount'
import { Pair } from './entities/pair'
import GambleswapPair from './abis/GambleswapPair.json'
import GambleswapLPLending from './abis/GambleswapLPLending.json'
import invariant from 'tiny-invariant'
import ERC20 from './abis/ERC20.json'
import { ChainId, BigintIsh, LENDING_ADDRESS, GMB_ADDRESS} from './constants'
import { Token } from './entities/token'

let TOKEN_DECIMALS_CACHE: { [chainId: number]: { [address: string]: number } } = {
  [ChainId.MAINNET]: {
    '0xE0B7927c4aF23765Cb51314A0E0521A9645F0E2A': 9 // DGD
  }
}
let getTokenInfo = async (addr: string, provider: Provider):Promise<string[]> => {
  // export const web3 = new Web3(new Web3.providers.HttpProvider(url));
    let token = new Contract(addr, ERC20.abi, provider)
    return ([await token.symbol(), await token.name()])
}

/**
 * Contains methods for constructing instances of pairs and tokens from on-chain data.
 */
export abstract class Fetcher {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  /**
   * Fetch information for a given token on the given chain, using the given ethers provider.
   * @param chainId chain of the token
   * @param address address of the token on the chain
   * @param provider provider used to fetch the token
   * @param symbol optional symbol of the token
   * @param name optional name of the token
   */
  public static async fetchTokenData(
    chainId: ChainId,
    address: string,
    provider = getDefaultProvider(getNetwork(chainId)),
    symbol?: string,
    name?: string
  ): Promise<Token> {
    const parsedDecimals =
      typeof TOKEN_DECIMALS_CACHE?.[chainId]?.[address] === 'number'
        ? TOKEN_DECIMALS_CACHE[chainId][address]
        : await new Contract(address, ERC20.abi, provider).decimals().then((decimals: number): number => {
            TOKEN_DECIMALS_CACHE = {
              ...TOKEN_DECIMALS_CACHE,
              [chainId]: {
                ...TOKEN_DECIMALS_CACHE?.[chainId],
                [address]: decimals
              }
            }
            return decimals
          })
    const [symbol_, name_] = await getTokenInfo(address, provider)
    return new Token(chainId, address, parsedDecimals, symbol || symbol_, name || name_)
    // return new Token(chainId, address, parsedDecimals, symbol, name)
  }

  /**
   * Fetches information about a pair and constructs a pair from the given two tokens.
   * @param tokenA first token
   * @param tokenB second token
   * @param provider the provider to use to fetch the data
   */
  public static async fetchPairData(
    tokenA: Token | undefined,
    tokenB: Token | undefined,
    provider: BaseProvider | undefined,
    address: string | undefined,
    chainId: undefined | ChainId,
  ): Promise<Pair> {
    if (address !== undefined && chainId !== undefined && provider !== undefined && tokenA === undefined && tokenB == undefined) {
      const pair = await new Contract(address, GambleswapPair.abi, provider)
      tokenA = await this.fetchTokenData(chainId, await pair.token0(), provider)
      tokenB = await this.fetchTokenData(chainId, await pair.token1(), provider)
      const [reserves0, reserves1] = await new Contract(address, GambleswapPair.abi, provider).getReserves()
      const balances = tokenA.sortsBefore(tokenB) ? [reserves0, reserves1] : [reserves1, reserves0]
      return new Pair(new TokenAmount(tokenA, balances[0]), new TokenAmount(tokenB, balances[1]), address)
    }
    else if (tokenA !== undefined && tokenB !== undefined){
      invariant(tokenA.chainId === tokenB.chainId, 'CHAIN_ID')
      if (provider === undefined)
        provider =  getDefaultProvider(getNetwork(tokenA.chainId))
      if (address === undefined)
        address = await Pair.getAddressWeb3(tokenA.address, tokenB.address)
      const [reserves0, reserves1] = await new Contract(address, GambleswapPair.abi, provider).getReserves()
      const balances = tokenA.sortsBefore(tokenB) ? [reserves0, reserves1] : [reserves1, reserves0]
      return new Pair(new TokenAmount(tokenA, balances[0]), new TokenAmount(tokenB, balances[1]), address)
  }
  else 
  throw "argument error"
}
  
  /**
   * Fetches information about a lending pool and constructs a pool from the given information.
   * @param index index of the pool in the lending contract
   * @param chainId
   * @param provider the provider to use to fetch the data
   */
  public static async fetchPoolData(
    index: BigintIsh,
    chainId: ChainId,
    provider = getDefaultProvider(getNetwork(chainId)),
  ): Promise<Pool> {
    const lending = await new Contract(LENDING_ADDRESS, GambleswapLPLending.abi, provider)

    const [
      lpTokenAddress, 
      lendersNum,
      totalLiquidity,
      totalLiquidityBorrowed,
      iPS,
      iPB,
      valid
    ] = await lending.pools(index)

    if (!valid)
      throw `Pool with index ${index} does not exists.`

    const pair = await this.fetchPairData(undefined, undefined, provider, lpTokenAddress, chainId)

    const gmb = await this.fetchTokenData(chainId, GMB_ADDRESS, provider)

    return new Pool(
      pair, 
      lendersNum, 
      new TokenAmount(pair.liquidityToken, totalLiquidity), 
      new TokenAmount(pair.liquidityToken, totalLiquidityBorrowed), 
      new TokenAmount(gmb, iPS), 
      new TokenAmount(gmb, iPB),
      index,
      provider
      )
  }

  /**
   * Fetches number of lending pools.
   * @param chainId
   * @param provider the provider to use to fetch the data
   */
   public static async fetchPoolsLength(
     chainId: ChainId,
     provider = getDefaultProvider(getNetwork(chainId)),
     ): Promise<number> {
       const lending = await new Contract(LENDING_ADDRESS, GambleswapLPLending.abi, provider)
       return await lending.poolsNumber()
    }
}
