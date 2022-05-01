import { TokenAmount } from './../../entities/fractions/tokenAmount';
import {
  BigintIsh,
  // INIT_CODE_HASH,
  _997,
  _1000,
} from '../constants'

export class Lender {
  public readonly address: string
  public readonly debtPerShare: BigintIsh;
  public readonly amount: TokenAmount;


  public constructor(
    address: string, 
    amount: TokenAmount, 
    dps: BigintIsh,
    ) {
    this.address = address;
    this.amount = amount;
    this.debtPerShare = dps;
  }

}
