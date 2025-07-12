'use client'

import { useEffect, useState } from 'react'
import { createPublicClient, formatEther, formatGwei, http } from 'viem'
import { hardhat } from 'viem/chains'

const client = createPublicClient({
  chain: hardhat,
  transport: http('http://127.0.0.1:8545')
})

interface BlockInfo {
  number: bigint
  timestamp: bigint
  gasUsed: bigint
  gasLimit: bigint
  transactionCount: number
  hash: string
  transactions: string[]
}

interface TransactionInfo {
  hash: string
  blockNumber: bigint
  blockHash: string
  from: string
  to: string | null
  value: bigint
  gasPrice: bigint
  gasUsed: bigint
  gasLimit: bigint
  status: 'success' | 'failed'
  timestamp: bigint
  input: string
  isContract: boolean
}

interface AccountInfo {
  address: string
  balance: bigint
}

export default function BlockchainExplorer() {
  const [latestBlock, setLatestBlock] = useState<BlockInfo | null>(null)
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [blockHistory, setBlockHistory] = useState<BlockInfo[]>([])
  const [recentTransactions, setRecentTransactions] = useState<TransactionInfo[]>([])
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionInfo | null>(null)
  const [showTransactionModal, setShowTransactionModal] = useState(false)

  // 获取最新区块信息
  const fetchLatestBlock = async () => {
    try {
      const blockNumber = await client.getBlockNumber()
              const block = await client.getBlock({ blockNumber })
        
        const blockInfo: BlockInfo = {
          number: block.number,
          timestamp: block.timestamp,
          gasUsed: block.gasUsed,
          gasLimit: block.gasLimit,
          transactionCount: block.transactions.length,
          hash: block.hash,
          transactions: block.transactions
        }
      
      setLatestBlock(blockInfo)
      return blockInfo
    } catch (err) {
      setError('获取区块信息失败: ' + (err as Error).message)
      return null
    }
  }

  // 获取交易详情
  const fetchTransactionDetails = async (txHash: string): Promise<TransactionInfo | null> => {
    try {
      const tx = await client.getTransaction({ hash: txHash as `0x${string}` })
      const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` })
      const block = await client.getBlock({ blockNumber: tx.blockNumber! })
      
      const transactionInfo: TransactionInfo = {
        hash: tx.hash,
        blockNumber: tx.blockNumber!,
        blockHash: tx.blockHash!,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        gasPrice: tx.gasPrice || BigInt(0),
        gasUsed: receipt.gasUsed,
        gasLimit: tx.gas,
        status: receipt.status === 'success' ? 'success' : 'failed',
        timestamp: block.timestamp,
        input: tx.input,
        isContract: tx.to === null || tx.input !== '0x'
      }
      
      return transactionInfo
    } catch (err) {
      console.error('获取交易详情失败:', err)
      return null
    }
  }

  // 获取最近交易
  const fetchRecentTransactions = async () => {
    try {
      const blockNumber = await client.getBlockNumber()
      const transactions: TransactionInfo[] = []
      
      // 获取最近几个区块的交易
      for (let i = 0; i < 5; i++) {
        const currentBlockNumber = blockNumber - BigInt(i)
        if (currentBlockNumber < 0) break
        
        const block = await client.getBlock({ 
          blockNumber: currentBlockNumber
        })
        
        for (const txHash of block.transactions) {
          const txDetails = await fetchTransactionDetails(txHash as string)
          if (txDetails) {
            transactions.push(txDetails)
          }
          // 限制最多显示20个交易
          if (transactions.length >= 20) break
        } 
        
        if (transactions.length >= 20) break
      }
      
      setRecentTransactions(transactions)
    } catch (err) {
      console.error('获取最近交易失败:', err)
    }
  }

  // 获取账户信息
  const fetchAccounts = async () => {
    try {
      // Hardhat 默认账户地址
      const hardhatAccounts = [
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
      ]
      
      const accountsInfo: AccountInfo[] = []
      
      for (const address of hardhatAccounts) {
        const balance = await client.getBalance({ address: address as `0x${string}` })
        accountsInfo.push({
          address,
          balance
        })
      }
      
      setAccounts(accountsInfo)
    } catch (err) {
      setError('获取账户信息失败: ' + (err as Error).message)
    }
  }

  // 获取区块历史
  const fetchBlockHistory = async () => {
    try {
      const currentBlock = await client.getBlockNumber()
      const history: BlockInfo[] = []
      
      // 获取最近10个区块
      for (let i = 0; i < 10; i++) {
        const blockNumber = currentBlock - BigInt(i)
        if (blockNumber < 0) break
        
        const block = await client.getBlock({ 
          blockNumber
        })
        history.push({
          number: block.number,
          timestamp: block.timestamp,
          gasUsed: block.gasUsed,
          gasLimit: block.gasLimit,
          transactionCount: block.transactions.length,
          hash: block.hash,
          transactions: block.transactions
        })
      }
      
      setBlockHistory(history)
    } catch (err) {
      setError('获取区块历史失败: ' + (err as Error).message)
    }
  }

  // 处理交易点击
  const handleTransactionClick = async (txHash: string) => {
    const txDetails = await fetchTransactionDetails(txHash)
    if (txDetails) {
      setSelectedTransaction(txDetails)
      setShowTransactionModal(true)
    }
  }

  // 初始化数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        fetchLatestBlock(),
        fetchAccounts(),
        fetchBlockHistory(),
        fetchRecentTransactions()
      ])
      setLoading(false)
    }
    
    loadData()
    
    // 每15秒刷新一次数据
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 格式化地址显示
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  // 交易详情模态框
  const TransactionModal = () => {
    if (!selectedTransaction) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">交易详情</h2>
            <button
              onClick={() => setShowTransactionModal(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">交易状态</p>
                <div className="flex items-center mt-1">
                  <div className={`w-3 h-3 rounded-full mr-2 ${
                    selectedTransaction.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className={`font-semibold ${
                    selectedTransaction.status === 'success' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {selectedTransaction.status === 'success' ? '成功' : '失败'}
                  </span>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">区块号</p>
                <p className="text-lg font-semibold text-gray-900">
                  #{selectedTransaction.blockNumber.toString()}
                </p>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500">交易哈希</p>
              <p className="text-sm font-mono text-gray-900 bg-gray-50 p-2 rounded">
                {selectedTransaction.hash}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">发送者</p>
                <p className="text-sm font-mono text-gray-900 bg-gray-50 p-2 rounded">
                  {selectedTransaction.from}
                </p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">接收者</p>
                <p className="text-sm font-mono text-gray-900 bg-gray-50 p-2 rounded">
                  {selectedTransaction.to || '合约创建'}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">金额</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatEther(selectedTransaction.value)} ETH
                </p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">类型</p>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedTransaction.isContract ? '合约交互' : '转账'}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Gas 价格</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatGwei(selectedTransaction.gasPrice)} Gwei
                </p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Gas 使用</p>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedTransaction.gasUsed.toLocaleString()}
                </p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Gas 限制</p>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedTransaction.gasLimit.toLocaleString()}
                </p>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500">时间</p>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(Number(selectedTransaction.timestamp) * 1000).toLocaleString()}
              </p>
            </div>
            
            {selectedTransaction.input !== '0x' && (
              <div>
                <p className="text-sm font-medium text-gray-500">输入数据</p>
                <p className="text-xs font-mono text-gray-900 bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                  {selectedTransaction.input}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载区块链数据...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">连接错误</h3>
          <p className="text-red-600">{error}</p>
          <p className="text-sm text-red-500 mt-2">请确保 Hardhat 节点正在运行在 http://127.0.0.1:8545</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🔍 Hardhat 区块浏览器</h1>
        <p className="text-gray-600">本地开发区块链状态监控</p>
      </div>

      {/* 网络状态 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">网络状态</p>
              <p className="text-2xl font-semibold text-green-600">在线</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">当前区块</p>
              <p className="text-2xl font-semibold text-blue-600">#{latestBlock?.number.toString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">总交易数</p>
              <p className="text-2xl font-semibold text-purple-600">
                {recentTransactions.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Gas 使用量</p>
              <p className="text-2xl font-semibold text-orange-600">
                {latestBlock?.gasUsed.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 最近交易 */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">🔄 最近交易</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  交易哈希
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  发送者
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  接收者
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  金额
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gas 费用
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  时间
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentTransactions.map((tx) => (
                <tr 
                  key={tx.hash} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleTransactionClick(tx.hash)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 ${
                        tx.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                      <span className={`text-sm font-medium ${
                        tx.status === 'success' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.status === 'success' ? '成功' : '失败'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-blue-600">
                      {formatAddress(tx.hash)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-900">
                      {formatAddress(tx.from)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-900">
                      {tx.to ? formatAddress(tx.to) : '合约创建'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatEther(tx.value)} ETH
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatEther(tx.gasUsed * tx.gasPrice)} ETH
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(Number(tx.timestamp) * 1000).toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 账户信息 */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">💰 账户余额</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4">
            {accounts.map((account, index) => (
              <div key={account.address} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-blue-600 font-semibold text-sm">{index}</span>
                  </div>
                  <div>
                    <p className="font-mono text-sm text-gray-900">{account.address}</p>
                    <p className="text-xs text-gray-500">账户 #{index}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900">
                    {formatEther(account.balance)} ETH
                  </p>
                  <p className="text-xs text-gray-500">余额</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 区块历史 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">📦 最近区块</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  区块号
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  时间戳
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  交易数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gas 使用
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  哈希
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {blockHistory.map((block) => (
                <tr key={block.hash} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      #{block.number.toString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(Number(block.timestamp) * 1000).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{block.transactionCount}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {block.gasUsed.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-mono">
                      {formatAddress(block.hash)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 交易详情模态框 */}
      {showTransactionModal && <TransactionModal />}
    </div>
  )
} 