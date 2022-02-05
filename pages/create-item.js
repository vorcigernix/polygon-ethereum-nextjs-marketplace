import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { create as ipfsHttpClient } from "ipfs-http-client";
import { useRouter } from "next/router";
import Web3Modal from "web3modal";
import QRCode from "qrcode";

const client = ipfsHttpClient("https://ipfs.infura.io:5001/api/v0");

import { nftaddress, nftmarketaddress } from "../config";

import NFT from "../artifacts/contracts/NFT.sol/NFT.json";
import Market from "../artifacts/contracts/Market.sol/NFTMarket.json";

export default function CreateItem() {
  const [fileUrl, setFileUrl] = useState(null);
  const [formInput, updateFormInput] = useState({
    price: "",
    name: "",
    description: "",
  });
  const router = useRouter();
  useEffect(() => {
    async function generateQR() {
      const file = await QRCode.toString("ahoooy");
      try {
        const added = await client.add(file, {
          progress: (prog) => console.log(`received: ${prog}`),
        });
        const url = `https://ipfs.infura.io/ipfs/${added.path}`;
        setFileUrl(url);
      } catch (error) {
        console.log("Error uploading file: ", error);
      }
    }
    generateQR();
  }, []);

  async function createMarket() {
    const { name, description, price } = formInput;
    if (!name || !description || !price || !fileUrl) return;
    /* first, upload to IPFS */
    const data = JSON.stringify({
      name,
      description,
      image: fileUrl,
    });
    try {
      const added = await client.add(data);
      const url = `https://ipfs.infura.io/ipfs/${added.path}`;
      /* after file is uploaded to IPFS, pass the URL to save it on Polygon */
      createSale(url);
    } catch (error) {
      console.log("Error uploading file: ", error);
    }
  }

  async function createSale(url) {
    const web3Modal = new Web3Modal();
    const connection = await web3Modal.connect();
    const provider = new ethers.providers.Web3Provider(connection);
    const signer = provider.getSigner();

    /* next, create the item */
    let contract = new ethers.Contract(nftaddress, NFT.abi, signer);
    let transaction = await contract.createToken(url);
    let tx = await transaction.wait();
    let event = tx.events[0];
    let value = event.args[2];
    let tokenId = value.toNumber();

    const price = ethers.utils.parseUnits(formInput.price, "ether");

    /* then list the item for sale on the marketplace */
    contract = new ethers.Contract(nftmarketaddress, Market.abi, signer);
    let listingPrice = await contract.getListingPrice();
    listingPrice = listingPrice.toString();

    transaction = await contract.createMarketItem(nftaddress, tokenId, price, {
      value: listingPrice,
    });
    await transaction.wait();
    router.push("/");
  }

  return (
    <>
      <section className="text-gray-600 body-font overflow-hidden">
        <div className="container px-5 py-24 mx-auto">
          <div className="lg:w-4/5 mx-auto flex flex-wrap">
            {fileUrl && (
              <img
                className="lg:w-1/2 w-full lg:h-auto h-64 object-cover object-center rounded"
                src={fileUrl}
                alt="QR Code"
              />
            )}
            <div className="lg:w-1/2 w-full lg:pl-10 lg:py-6 mt-6 lg:mt-0">
              <h2 className="text-sm title-font text-gray-500 tracking-widest">
                CREATE ORDER
              </h2>
              <h1 className="text-gray-900 text-3xl title-font font-medium mb-5">
                {" "}
                <input
                  placeholder="Asset Name"
                  className="mt-8 border rounded p-4"
                  onChange={(e) =>
                    updateFormInput({ ...formInput, name: e.target.value })
                  }
                />
              </h1>
              <textarea
                placeholder="Asset Description"
                className="mt-2 border rounded p-4 leading-relaxed w-full"
                onChange={(e) =>
                  updateFormInput({ ...formInput, description: e.target.value })
                }
              />
              <div className="flex mt-6 items-center pb-5 border-b-2 border-gray-100 mb-5">
                <div className=" items-center">
                  <span className="mr-3">Quantity</span>
                  <div className="relative">
                    <input
                      placeholder="60"
                      className="border rounded py-2 pl-3 pr-10 w-20"
                      onChange={(e) =>
                        updateFormInput({ ...formInput, qty: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="ml-6 items-center">
                  <span className="mr-3">SKU</span>
                  <div className="relative">
                    <select
                      className="rounded border appearance-none border-gray-300 py-2 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-500 text-base pl-3 pr-10"
                      onChange={(e) =>
                        updateFormInput({ ...formInput, sku: e.target.value })
                      }
                    >
                      <option>Barrel</option>
                      <option>XL Bags</option>
                      <option>L Bags</option>
                    </select>
                    <span className="absolute right-0 top-0 h-full w-10 text-center text-gray-600 pointer-events-none flex items-center justify-center">
                      <svg
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                      >
                        <path d="M6 9l6 6 6-6"></path>
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
              <div className="items-center">
                <span className="mr-3">Price</span>
                <div className="relative">
                  <input
                    placeholder="$60"
                    className="border text-gray-900 text-2xl title-font font-medium w-full rounded py-2 pl-3 "
                    onChange={(e) =>
                      updateFormInput({ ...formInput, price: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-center">
        <div className="w-1/2 flex flex-col pb-12">
          <button
            onClick={createMarket}
            className="font-bold mt-4 bg-sky-500 text-white rounded p-4 shadow-lg"
          >
            Create Order
          </button>
        </div>
      </div>
    </>
  );
}
