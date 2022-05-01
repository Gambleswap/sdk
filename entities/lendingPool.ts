import { Pair } from 'entities/pair';
import { Lender } from './lender';

import { TokenAmount } from './fractions/tokenAmount'
import { Contract } from '@ethersproject/contracts'
import { getNetwork } from '@ethersproject/networks'
import { getDefaultProvider } from '@ethersproject/providers'

import LendingABI from '../abis/GambleswapLPLending.json'

import {
  BigintIsh,
  LENDING_ADDRESS,
  _997,
  _1000,
} from '../src/constants'
import { Provider } from '@ethersproject/providers'


export class Pool {
  public readonly liquidityPair: Pair
  public readonly lendersNum: BigintIsh;
  public readonly totalLiquidity: TokenAmount;
  public readonly totalLiquidityBorrowed: TokenAmount;
  public readonly interestPerShare: TokenAmount;
  public readonly interestPerBorrow: TokenAmount;
  public readonly index: BigintIsh;
  private provider: Provider;

  public constructor(
    token: Pair, 
    num: BigintIsh, 
    total: TokenAmount, 
    totalBorrowed: TokenAmount, 
    iPerShare: TokenAmount, 
    iPB: TokenAmount, 
    index: BigintIsh,
    provider = getDefaultProvider(getNetwork(token.chainId))
    ) {
    this.liquidityPair = token;
    this.lendersNum = num;
    this.totalLiquidity = total;
    this.totalLiquidityBorrowed = totalBorrowed;
    this.interestPerShare = iPerShare;
    this.interestPerBorrow = iPB;
    this.index = index
    this.provider = provider
  }

  /**
  * Fetches data for user on the lending pool.
  * @param address lender address
  */
  public async getLenderData(address: string): Promise<Lender> {
    const lending = await new Contract(LENDING_ADDRESS, LendingABI.abi, this.provider)
    const [
      amount,
      debtShare,
      valid
    ] = await lending.lenders(this.index, address)
    if (!valid)
      throw `address ${address} didn't participated in pool ${this.index}`
      let amount2 = amount*1e-12
      return new Lender(address, new TokenAmount(this.liquidityPair.liquidityToken, `${amount2.toFixed()}`), debtShare)
    }
}
