import * as anchor from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import { assert } from 'chai';
import fs from 'fs';

describe('merkle_rewards', () => {
    // Set up the client
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const idl = JSON.parse(fs.readFileSync('target/idl/merkle_rewards.json', 'utf8'));
    const programId = new PublicKey("AG2tDEdvdSNvLnmdnLfAhKcfwj5d9RexzuaAhVtxEtEU");
    const program = new anchor.Program(idl, programId, provider);

    const merkleRoot = Buffer.from('995c0178e224c170e7d19f761002d73c1a8bdf4ae2a31d8782b046a67557cf4d', 'hex');

    const wallet = provider.wallet;

    it('initializes the Merkle tree', async () => {
        // Generate the Merkle tree account with seed and bump
        const [merkleTreePda, bump] = await PublicKey.findProgramAddress(
            [Buffer.from("merkle_tree")],
            program.programId
        );

        console.log("merkleTreePda ", merkleTreePda.toString());

        // Add event listener for MerkleRootInitialized
        const listenerMerkleRootInitialized = program.addEventListener('MerkleRootInitialized', (event, slot) => {
            console.log(`MerkleRootInitialized at slot ${slot} with root ${Buffer.from(event.merkleRoot).toString('hex')}`);
        });

        // Initialize the Merkle tree
        await program.methods.initialize(Array.from(merkleRoot))
            .accounts({
                merkleTree: merkleTreePda,
                user: wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([wallet.payer])
            .rpc({ skipPreflight: false });

        // Fetch the account and check the Merkle root
        const account = await program.account.merkleTree.fetch(merkleTreePda);
        assert.deepEqual(account.merkleRoot, Array.from(merkleRoot));

        // Remove event listener
        await program.removeEventListener(listenerMerkleRootInitialized);
    });

    it('claims rewards with a valid proof for Wallet 1', async () => {
        // Generate the Merkle tree account with seed and bump
        const [merkleTreePda, bump] = await PublicKey.findProgramAddress(
            [Buffer.from("merkle_tree")],
            program.programId
        );

        // Define the amount to claim and generate a proof for Wallet 1
        const amount = 5;
        const proof = [Buffer.from('bcc35fbd0ba0793927039c72d1fa6d4a48a2b938cd7a526b050d21074735298a', 'hex')];

        // Format the proof as an array of arrays of 32-byte buffers
        const formattedProof = proof.map(p => Array.from(p));
        const value = new anchor.BN(amount);
        console.log(wallet.publicKey);

        // Claim the rewards
        try {
            await program.methods.claim(value, formattedProof)
                .accounts({
                    merkleTree: merkleTreePda,
                    user: wallet.publicKey,
                })
                .signers([wallet.payer])
                .rpc({ skipPreflight: false });
        } catch (error) {
            console.error("Error during claim:", error);
        }

    });
});
